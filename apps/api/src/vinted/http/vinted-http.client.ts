import { Injectable, Logger } from '@nestjs/common';
import type { AxiosResponse, Method } from 'axios';
import type { ZodType, ZodTypeDef } from 'zod';
import { AccountCredentialsStore } from '../../accounts/account-credentials.store.js';
import { AccountNeedsReconnectException } from '../../accounts/account-needs-reconnect.exception.js';
import { HttpService } from '../../common/http/http.service.js';
import { VintedAuthService } from '../auth/vinted-auth.service.js';
import { VINTED_DEFAULT_USER_AGENT } from '../vinted-platform.config.js';
import type { AccountDocument } from '../../accounts/schemas/account.schema.js';

export interface VintedRequestConfig<T = unknown> {
  method?: Method;
  url: string;
  data?: unknown;
  label?: string;
  responseSchema?: ZodType<T, ZodTypeDef, unknown>;
  /** Headers spécifiques au call (multipart Content-Type, Referer custom…). */
  headers?: Record<string, string>;
}

/**
 * Client HTTP authentifié pour `www.vinted.fr/api`.
 * Vinted est cookie-based : on rejoue les cookies capturés au login Playwright
 * (access_token_web + session + datadome + cf_clearance) + les headers
 * `x-csrf-token` / `x-anon-id`. Le transport (axios + logs) est délégué à HttpService.
 *
 * Refresh proactif via `VintedAuthService.ensureValidToken` à chaque requête.
 * Sur 401/403 réactif (token rejeté entre temps) → AccountNeedsReconnectException.
 */
@Injectable()
export class VintedHttpClient {
  private readonly logger = new Logger(VintedHttpClient.name);

  constructor(
    private readonly auth: VintedAuthService,
    private readonly http: HttpService,
    private readonly store: AccountCredentialsStore,
  ) {}

  async request<T = unknown>(
    account: AccountDocument,
    config: VintedRequestConfig<T>,
  ): Promise<AxiosResponse<T>> {
    const creds = await this.auth.ensureValidToken(account);

    const cookiePairs: Array<[string, string | undefined]> = [
      ['access_token_web', creds.accessToken],
      ['refresh_token_web', creds.refreshToken],
      ['_vinted_fr_session', creds.sessionCookie],
      ['datadome', creds.datadomeCookie],
      ['cf_clearance', creds.cfClearanceCookie],
      ['anon_id', creds.anonId],
    ];
    const cookie = cookiePairs
      .filter(([, v]) => !!v)
      .map(([k, v]) => `${k}=${v}`)
      .join('; ');

    const headers: Record<string, string> = {
      'User-Agent': creds.userAgent || VINTED_DEFAULT_USER_AGENT,
      Accept: 'application/json, text/plain, */*',
      'Accept-Language': 'fr',
      'x-csrf-token': creds.csrfToken,
      Cookie: cookie,
      ...(config.headers ?? {}),
    };
    if (creds.anonId) headers['x-anon-id'] = creds.anonId;

    const res = await this.http.request<T>({
      method: config.method ?? 'GET',
      url: config.url,
      data: config.data,
      headers,
      label: config.label ?? `vinted:${account._id.toString().slice(-6)}`,
      responseSchema: config.responseSchema,
    });

    // 401 = token rejeté côté Vinted. ensureValidToken a déjà refreshé proactivement
    // si l'expiration approchait, donc un 401 ici = creds vraiment cassés.
    if (res.status === 401) {
      await this.store.markNeedsReconnect(account._id);
      throw new AccountNeedsReconnectException(
        account,
        `HTTP 401 sur ${config.url} (token rejeté après refresh proactif)`,
      );
    }
    // 403 = erreur métier Vinted (ex: access_denied code=106 sur un item qui n'est
    // plus le tien, déjà supprimé, etc.). On laisse bubble — pas une auth cassée.
    // Toute réponse non-401 prouve que les creds marchent : reset le flag si stale.
    if (account.needsReconnect) {
      await this.store.markConnected(account._id);
      account.needsReconnect = false;
      account.isConnected = true;
    }
    return res;
  }
}
