import { randomUUID } from 'node:crypto';
import { Injectable, Logger } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { PUBLISH_QUEUE, type PublishJobData } from './publish.queue.js';

/** Résultat d'une tentative d'acquisition. */
export interface LockAcquireResult {
  acquired: boolean;
  /**
   * Si non acquis ET qu'un cooldown est en cours : durée restante (ms) avant de
   * pouvoir réessayer → le job peut dormir exactement ce temps (1 seul defer).
   * `undefined` quand le verrou est juste pris par une publication en cours
   * (de courte durée) → l'appelant re-teste à intervalle court.
   */
  cooldownRemainingMs?: number;
}

/**
 * Exclusion mutuelle par clé `{userId}:{platform}` + cooldown entre 2
 * publications d'une même plateforme.
 *
 * Deux clés Redis distinctes (réutilisent la connexion ioredis de BullMQ) :
 *  - `publish-lock:{key}`     : détenu PENDANT la publication (TTL sécurité 10
 *                               min, filet si un worker crash). Court-vivant.
 *  - `publish-cooldown:{key}` : posé APRÈS une remontée réussie (TTL = durée du
 *                               cooldown, 2–3 min). Bloque la prochaine
 *                               publication de la même plateforme.
 *
 * Séparer les deux évite de confondre « publication en cours » (TTL 10 min) et
 * « cooldown » (2–3 min) : le job en attente dort la bonne durée.
 */
@Injectable()
export class PublishLockService {
  private readonly logger = new Logger(PublishLockService.name);

  /** TTL filet de sécurité du verrou : libère si un worker crash sans release. */
  static readonly TTL_MS = 10 * 60 * 1000;

  /** Token détenu par clé, pour ne libérer que SON verrou (évite les races TTL). */
  private readonly tokens = new Map<string, string>();

  constructor(
    @InjectQueue(PUBLISH_QUEUE) private readonly queue: Queue<PublishJobData>,
  ) {}

  private lockKey(key: string): string {
    return `publish-lock:${key}`;
  }

  private cooldownKey(key: string): string {
    return `publish-cooldown:${key}`;
  }

  /**
   * Tente d'acquérir le verrou. Refuse si un cooldown est en cours (et renvoie
   * sa durée restante) ou si une publication est déjà en cours sur cette clé.
   */
  async acquire(
    key: string,
    ttlMs = PublishLockService.TTL_MS,
  ): Promise<LockAcquireResult> {
    const client = await this.queue.client;

    const cooldownTtl = await client.pttl(this.cooldownKey(key));
    if (cooldownTtl > 0) {
      return { acquired: false, cooldownRemainingMs: cooldownTtl };
    }

    const token = randomUUID();
    const res = await client.set(this.lockKey(key), token, 'PX', ttlMs, 'NX');
    if (res === 'OK') {
      this.tokens.set(key, token);
      return { acquired: true };
    }
    return { acquired: false };
  }

  /** Libère le verrou uniquement si on en est le détenteur (check-and-del Lua). */
  async release(key: string): Promise<void> {
    const token = this.tokens.get(key);
    if (!token) return;
    this.tokens.delete(key);
    await this.delIfOwner(key, token);
  }

  /**
   * Libère le verrou ET pose un cooldown de `ms` : la prochaine publication sur
   * la même clé (user, plateforme) devra attendre `ms` → espacement entre
   * annonces d'une plateforme.
   */
  async cooldown(key: string, ms: number): Promise<void> {
    const token = this.tokens.get(key);
    this.tokens.delete(key);
    const client = await this.queue.client;
    try {
      await client.set(this.cooldownKey(key), '1', 'PX', ms);
    } catch (err) {
      this.logger.warn(`Cooldown ${key} a échoué : ${(err as Error).message}`);
    }
    if (token) await this.delIfOwner(key, token);
  }

  private async delIfOwner(key: string, token: string): Promise<void> {
    const client = await this.queue.client;
    const lua =
      'if redis.call("get", KEYS[1]) == ARGV[1] then return redis.call("del", KEYS[1]) else return 0 end';
    try {
      await client.eval(lua, 1, this.lockKey(key), token);
    } catch (err) {
      // Le TTL finira par nettoyer — on logge sans casser le flow.
      this.logger.warn(`Release lock ${key} a échoué : ${(err as Error).message}`);
    }
  }
}
