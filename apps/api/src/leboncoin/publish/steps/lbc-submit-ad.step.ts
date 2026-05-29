import { Injectable, Logger } from '@nestjs/common';
import { randomBytes, randomUUID } from 'node:crypto';
import { LeboncoinHttpClient } from '../../http/leboncoin-http.client.js';
import {
  LBC_DEPOSIT_PAGE,
  LBC_SUBMIT_AD_URL,
  LBC_WEB_HOST,
} from '../../leboncoin-platform.config.js';
import type { PublishStep } from '../../../publish/publish-step.interface.js';
import type { LbcPublishContext } from '../leboncoin-publish.context.js';
import {
  LbcSubmitAdResponseSchema,
  type LbcSubmitAdResponse,
} from '../leboncoin-publish.schemas.js';
import type { LbcDepositConfigResponse } from '../leboncoin-deposit-schema.schemas.js';

/**
 * Step final — Soumet l'annonce sur Leboncoin.
 *
 * POST /api/adsubmit/v2/classifieds?with_variation=true
 *
 * Construit le body à partir de `ctx.resolvedAttrs` (rempli par le step
 * resolve-attributes) et `ctx.depositSchema` (récupéré par le step
 * fetch-deposit-schema). Chaque valeur est rangée à l'endroit indiqué par
 * le `codec_type` de son item :
 *   - CODEC_TYPE_ROOT                → racine du body
 *   - CODEC_TYPE_ATTRIBUTES          → body.attributes
 *   - CODEC_TYPE_EXTENDED_ATTRIBUTES → body.extended_attributes
 *
 * Les champs structurels (`category_id`, `ad_type`) sont ajoutés directement
 * par ce step — pas dépendants du schéma.
 *
 * Sur succès, LBC renvoie `{ status: "created", ad_id: <number>, ... }`.
 */
@Injectable()
export class LbcSubmitAdStep implements PublishStep<LbcPublishContext> {
  readonly name = 'submit-ad';

  private readonly logger = new Logger(LbcSubmitAdStep.name);

  constructor(private readonly client: LeboncoinHttpClient) {}

  async execute(ctx: LbcPublishContext): Promise<void> {
    if (!ctx.category?.id) {
      throw new Error('Submit LBC : catégorie absente (step classify manqué ?)');
    }
    if (!ctx.depositSchema) {
      throw new Error(
        'Submit LBC : depositSchema absent (step fetch-deposit-schema manqué ?)',
      );
    }
    if (!ctx.resolvedAttrs) {
      throw new Error(
        'Submit LBC : resolvedAttrs absent (step resolve-attributes manqué ?)',
      );
    }
    if (!ctx.defaultLocation) {
      throw new Error(
        'Submit LBC : pas de location par défaut — configure-la dans /settings',
      );
    }

    const body = buildSubmitBody(
      ctx.category.id,
      ctx.depositSchema,
      ctx.resolvedAttrs,
    );

    const res = await this.client.request<LbcSubmitAdResponse>(ctx.account, {
      method: 'POST',
      url: LBC_SUBMIT_AD_URL,
      data: body,
      label: 'lbc:publish:submit',
      responseSchema: LbcSubmitAdResponseSchema,
      headers: {
        Referer: LBC_DEPOSIT_PAGE,
        // L'endpoint adsubmit est protégé plus strictement que pintad
        // (upload/delete) : le front envoie ce header A/B + les feature-flags
        // de la page de dépôt. Sans eux, LBC renvoie 403 (body vide).
        'x-lbc-experiment': buildExperimentHeader(ctx.account.externalUserId),
      },
    });

    if (res.status < 200 || res.status >= 300) {
      throw new Error(
        `Submit LBC HTTP ${res.status} — body: ${JSON.stringify(res.data)?.slice(0, 300)}`,
      );
    }

    const adId = String(res.data.ad_id);
    ctx.externalId = adId;
    // URL canonique LBC : /ad/<slug-catégorie>/<ad_id> (ex: /ad/collection/123).
    ctx.externalUrl = `${LBC_WEB_HOST}/ad/${slugifyCategory(ctx.category.name)}/${adId}`;
    ctx.actionId = res.data.action_id;

    this.logger.log(
      `Annonce LBC créée : ad_id=${adId} status="${res.data.status}" action_id=${res.data.action_id ?? '?'}`,
    );
  }
}

/** "Collection" → "collection", "Arts de la table" → "arts_de_la_table". */
function slugifyCategory(name: string): string {
  return name
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '') // retire les accents
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
}

// ─── Construction du body : drivée par le schéma ─────────────────────────

interface SubmitBody {
  category_id: string;
  ad_type: 'sell';
  tracking_dd: string;
  attributes: Record<string, unknown>;
  extended_attributes: Record<string, unknown>;
  [key: string]: unknown;
}

/**
 * Construit le header `x-lbc-experiment` (base64 JSON) tel que le front le
 * génère depuis ses cookies A/B. LBC ne possède pas ces IDs (ce sont ses
 * propres IDs d'expérimentation), donc on peut les générer : `rollout_visitor_id`
 * est un UUID, les deux autres des hex 32 bytes. `experiment_user_id` est dérivé
 * de l'user LBC pour rester stable d'un publish à l'autre.
 */
function buildExperimentHeader(externalUserId: string): string {
  const payload = {
    version: 1,
    rollout_visitor_id: randomUUID(),
    experiment_visitor_id: randomBytes(32).toString('hex'),
    experiment_user_id: externalUserId,
  };
  return Buffer.from(JSON.stringify(payload), 'utf8').toString('base64');
}

function buildSubmitBody(
  categoryId: string,
  schema: LbcDepositConfigResponse,
  resolved: Record<string, unknown>,
): SubmitBody {
  const body: SubmitBody = {
    category_id: categoryId,
    ad_type: 'sell',
    // Champ de tracking client-side envoyé par le front sur le dépôt. Non
    // dérivé du schéma — valeur statique alignée sur le navigateur.
    tracking_dd:
      'app:392.45.23|dd:adlife-adparams-chips:false|adlife-merge-photo-adparams:false|adlife-oneclick:false',
    attributes: {},
    extended_attributes: {},
  };

  for (const item of schema.definitions.items) {
    const key = item.answer_modelization?.representation?.associated_key;
    if (!key) continue;
    const codec = item.answer_modelization?.representation?.codec_type;
    if (!codec || codec === 'CODEC_TYPE_NONE') continue;

    const value = resolved[key];
    if (value === undefined) continue;

    placeInBody(body, codec, key, value);
  }

  return body;
}

function placeInBody(
  body: SubmitBody,
  codec: string,
  key: string,
  value: unknown,
): void {
  switch (codec) {
    case 'CODEC_TYPE_ROOT':
      body[key] = value;
      return;
    case 'CODEC_TYPE_ATTRIBUTES':
      body.attributes[key] = value;
      return;
    case 'CODEC_TYPE_EXTENDED_ATTRIBUTES':
      body.extended_attributes[key] = value;
      return;
    default:
      // Codec inconnu — on tombe sur la racine pour ne pas perdre l'info.
      body[key] = value;
  }
}

