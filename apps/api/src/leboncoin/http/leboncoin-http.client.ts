import { Injectable, Logger } from '@nestjs/common';
import { CookieJar } from 'tough-cookie';
import type { AxiosResponse, Method } from 'axios';
import type { ZodType } from 'zod';
import type { LeboncoinCredentials } from '@crosspost/shared';
import { LeboncoinAuthService } from '../auth/leboncoin-auth.service.js';
import { AccountCredentialsStore } from '../../accounts/account-credentials.store.js';
import { HttpService } from '../../common/http/http.service.js';
import type { AccountDocument } from '../../accounts/schemas/account.schema.js';
import { buildLbcApiHeaders } from './leboncoin-headers.js';
import { LBC_API_HOST } from '../leboncoin-platform.config.js';

export interface LeboncoinRequestConfig<T = unknown> {
  method?: Method;
  url: string;
  data?: unknown;
  headers?: Record<string, string>;
  label?: string;
  /** Schema Zod pour valider la réponse 2xx (auto-typage de `res.data`). */
  responseSchema?: ZodType<T>;
}

/**
 * Client HTTP authentifié pour `api.leboncoin.fr`.
 * Responsabilités spécifiques LBC :
 *  - Refresh JWT à la volée si nécessaire (via LeboncoinAuthService)
 *  - Cookie jar par compte (jamais partagé entre users)
 *  - Persiste le nouveau cookie datadome si DataDome le reroule
 * Le transport (axios + logs + sanitisation) est délégué à HttpService.
 */
@Injectable()
export class LeboncoinHttpClient {
  private readonly logger = new Logger(LeboncoinHttpClient.name);

  constructor(
    private readonly auth: LeboncoinAuthService,
    private readonly store: AccountCredentialsStore,
    private readonly http: HttpService,
  ) {}

  async request<T = unknown>(
    account: AccountDocument,
    config: LeboncoinRequestConfig<T>,
  ): Promise<AxiosResponse<T>> {
    const creds = await this.auth.ensureValidToken(account);
    const jar = new CookieJar();
    await jar.setCookie(
      `datadome=${creds.datadomeCookie}; Domain=.leboncoin.fr; Path=/`,
      LBC_API_HOST,
    );

    const res = await this.http.request<T>({
      method: config.method ?? 'GET',
      url: config.url,
      data: config.data,
      headers: {
        ...buildLbcApiHeaders(creds.userAgent),
        Authorization: `Bearer ${creds.accessToken}`,
        ...(config.headers ?? {}),
      },
      jar,
      label: config.label ?? `lbc:${account._id.toString().slice(-6)}`,
      responseSchema: config.responseSchema,
    });

    await this.maybePersistDatadomeReroll(account, jar, creds);
    return res;
  }

  private async maybePersistDatadomeReroll(
    account: AccountDocument,
    jar: CookieJar,
    creds: LeboncoinCredentials,
  ): Promise<void> {
    try {
      const cookies = await jar.getCookies(LBC_API_HOST);
      const newDatadome = cookies.find((c) => c.key === 'datadome')?.value;
      if (newDatadome && newDatadome !== creds.datadomeCookie) {
        const updated: LeboncoinCredentials = {
          ...creds,
          datadomeCookie: newDatadome,
        };
        await this.store.updateCredentials(
          account._id,
          updated,
          account.tokenExpiresAt,
        );
      }
    } catch (err) {
      this.logger.warn(
        `Échec persistence du datadome reroll : ${(err as Error).message}`,
      );
    }
  }
}
