import { Injectable, Logger } from '@nestjs/common';
import axios, {
  type AxiosResponse,
  type Method,
  type AxiosError,
} from 'axios';
import { wrapper } from 'axios-cookiejar-support';
import type { CookieJar } from 'tough-cookie';
import type { ZodIssue, ZodType } from 'zod';

export interface HttpRequestOptions<T = unknown> {
  /** Méthode HTTP (default: GET). */
  method?: Method;
  /** URL absolue. */
  url: string;
  /** Headers, fusionnés avec ceux fournis par la jar (cookies). */
  headers?: Record<string, string>;
  /** Body : objet (JSON.stringify) ou string (envoyé tel quel). */
  data?: unknown;
  /** Cookie jar partagé. Lecture/écriture automatique par axios-cookiejar-support. */
  jar?: CookieJar;
  /** Timeout en ms (default: 30_000). */
  timeout?: number;
  /** Label pour les logs (ex: "lbc:dashboard"). Aide à filtrer dans une longue trace. */
  label?: string;
  /**
   * Zod schema appliqué au body en cas de réponse 2xx. Throw HttpValidationError
   * si le payload ne match pas. Recommandation : utiliser `.passthrough()` sur les
   * objets pour ne pas casser quand LBC/Vinted ajoute un nouveau champ.
   */
  responseSchema?: ZodType<T>;
}

/**
 * Service HTTP générique, partagé entre toutes les plateformes (Leboncoin, Vinted, ...).
 * Loggue chaque appel + réponse (avec sanitisation des secrets dans les headers).
 * Pas de logique métier — juste le transport.
 */
@Injectable()
export class HttpService {
  private readonly logger = new Logger(HttpService.name);

  async request<T = unknown>(
    opts: HttpRequestOptions<T>,
  ): Promise<AxiosResponse<T>> {
    const method = (opts.method ?? 'GET').toUpperCase() as Method;
    const label = opts.label ?? 'http';
    const start = Date.now();

    this.logger.log(`[${label}] → ${method} ${opts.url}`);
    if (opts.headers) {
      this.logger.debug(
        `[${label}] headers: ${JSON.stringify(sanitizeHeaders(opts.headers))}`,
      );
    }
    if (opts.data !== undefined) {
      this.logger.debug(
        `[${label}] body: ${truncate(sanitizeBodySample(opts.data), 400)}`,
      );
    }

    const instance = wrapper(
      axios.create({
        headers: opts.headers,
        timeout: opts.timeout ?? 30_000,
        validateStatus: () => true,
        maxRedirects: 0,
      }),
    );
    if (opts.jar) {
      (instance.defaults as { jar?: CookieJar }).jar = opts.jar;
    }

    try {
      const res = await instance.request<T>({
        method,
        url: opts.url,
        data: opts.data,
      });
      const ms = Date.now() - start;
      this.logger.log(`[${label}] ← ${res.status} (${ms}ms)`);
      this.logger.debug(
        `[${label}] response body: ${truncate(sanitizeBodySample(res.data), 400)}`,
      );

      // Validation Zod : seulement sur 2xx (les 4xx/5xx ont un format d'erreur différent)
      if (opts.responseSchema && res.status >= 200 && res.status < 300) {
        const parsed = opts.responseSchema.safeParse(res.data);
        if (!parsed.success) {
          const issues = parsed.error.issues
            .slice(0, 5)
            .map((i) => `${i.path.join('.') || '<root>'}: ${i.message}`)
            .join(' | ');
          this.logger.error(`[${label}] ✗ Validation Zod échouée: ${issues}`);
          throw new HttpValidationError(label, opts.url, parsed.error.issues);
        }
        // Typage : la donnée validée remplace res.data
        (res as AxiosResponse<T>).data = parsed.data;
      }

      return res;
    } catch (err) {
      const ms = Date.now() - start;
      const axiosErr = err as AxiosError;
      this.logger.error(
        `[${label}] ✗ ${axiosErr.code ?? 'network'} ${axiosErr.message} (${ms}ms)`,
      );
      throw err;
    }
  }
}

/**
 * Levée quand un retour HTTP 2xx ne match pas le `responseSchema` Zod fourni.
 * Sert à détecter une régression silencieuse côté plateforme (LBC change un format).
 */
export class HttpValidationError extends Error {
  constructor(
    public readonly label: string,
    public readonly url: string,
    public readonly issues: ZodIssue[],
  ) {
    const summary = issues
      .slice(0, 3)
      .map((i) => `${i.path.join('.') || '<root>'}: ${i.message}`)
      .join(' | ');
    super(`Validation Zod échouée sur ${url} [${label}]: ${summary}`);
    this.name = 'HttpValidationError';
  }
}

// ─── Sanitisation des secrets pour les logs ─────────────────────────────────

const SENSITIVE_HEADER_NAMES = new Set([
  'authorization',
  'cookie',
  'set-cookie',
  'x-api-key',
  'x-auth-token',
  'login-id',
  'x-fingerprint',
]);

function sanitizeHeaders(
  headers: Record<string, string>,
): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(headers)) {
    const lk = k.toLowerCase();
    if (!SENSITIVE_HEADER_NAMES.has(lk)) {
      out[k] = v;
      continue;
    }
    if (lk === 'cookie' || lk === 'set-cookie') {
      // Garde uniquement les noms des cookies (pas les valeurs)
      const names = v
        .split(';')
        .map((s) => s.trim().split('=')[0])
        .filter(Boolean);
      out[k] = `${names.join(', ')} [values redacted]`;
    } else {
      out[k] =
        v.length > 14 ? `${v.slice(0, 10)}...[redacted ${v.length - 10}]` : '[redacted]';
    }
  }
  return out;
}

const SENSITIVE_BODY_FIELDS = new Set([
  'password',
  'access_token',
  'accesstoken',
  'refresh_token',
  'refreshtoken',
  'token',
  'secret',
  'authorization',
]);

function sanitizeBodySample(body: unknown): string {
  try {
    if (typeof body === 'string') {
      // Body URL-encoded ou texte — on remplace les paires sensibles
      return body.replace(
        /([?&]?)(password|access_token|refresh_token|token)=[^&\s]+/gi,
        '$1$2=[REDACTED]',
      );
    }
    if (typeof body !== 'object' || body === null) {
      return String(body);
    }
    return JSON.stringify(redactObject(body));
  } catch {
    return '[unloggable body]';
  }
}

function redactObject(obj: unknown): unknown {
  if (Array.isArray(obj)) return obj.map(redactObject);
  if (obj !== null && typeof obj === 'object') {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(obj as Record<string, unknown>)) {
      out[k] = SENSITIVE_BODY_FIELDS.has(k.toLowerCase())
        ? '[REDACTED]'
        : redactObject(v);
    }
    return out;
  }
  return obj;
}

function truncate(s: string, max: number): string {
  if (s.length <= max) return s;
  return `${s.slice(0, max)}... [+${s.length - max} chars]`;
}
