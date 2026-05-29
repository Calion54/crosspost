import {
  Injectable,
  Logger,
  UnauthorizedException,
  InternalServerErrorException,
} from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import type { Page } from 'playwright';
import {
  LeboncoinCredentialsSchema,
  type LeboncoinCredentials,
} from '@crosspost/shared';

/** Heuristique pour extraire un refresh_token d'un blob de localStorage. */
const RefreshTokenContainerSchema = z.object({
  refresh_token: z.string(),
});
import {
  LBC_AUTHORIZE_ENDPOINT,
  LBC_CLIENT_ID,
  LBC_JWT_REFRESH_SKEW_MS,
  LBC_LOGIN_PAGE,
  LBC_LOGOUT_ENDPOINT,
  LBC_ME_ACCOUNT_URL,
  LBC_OAUTH_REDIRECT_URI,
  LBC_OAUTH_SCOPE,
  LBC_TOKEN_ENDPOINT,
  LBC_WEB_HOST,
} from '../leboncoin-platform.config.js';
import {
  LbcMeAccountResponseSchema,
  extractPhoneNumber,
} from './leboncoin-account.schemas.js';
import {
  LBC_DEFAULT_USER_AGENT,
  buildLbcApiHeaders,
} from '../http/leboncoin-headers.js';
import { AccountCredentialsStore } from '../../accounts/account-credentials.store.js';
import { BrowserService } from '../../browser/browser.service.js';
import { HttpService } from '../../common/http/http.service.js';
import type { AccountDocument } from '../../accounts/schemas/account.schema.js';
import type { PlatformAuthAdapter } from '../../accounts/platform-auth.types.js';

export interface LoginResult {
  credentials: LeboncoinCredentials;
  externalUserId: string;
  tokenExpiresAt: Date;
  /** Téléphone du vendeur (capturé via /me/account juste après le login). */
  phone?: string;
}

interface JwtPayload {
  account_id: string;
  exp: number;
  iat: number;
  [k: string]: unknown;
}

@Injectable()
export class LeboncoinAuthService implements PlatformAuthAdapter {
  private readonly logger = new Logger(LeboncoinAuthService.name);

  constructor(
    private readonly store: AccountCredentialsStore,
    private readonly browser: BrowserService,
    private readonly http: HttpService,
  ) {}

  /**
   * Login one-shot via browser. Lance Chromium, fait passer le 2-step
   * email/password, capture le Bearer JWT + refresh_token + cookie datadome.
   *
   * Coût : ~3-8s par appel. Doit être idéalement appelé une fois par compte (au
   * moment de la connexion initiale), puis on garde la session vivante via refresh
   * HTTP pur.
   */
  async loginWithPassword(
    email: string,
    password: string,
  ): Promise<LoginResult> {
    return this.browser.withPage(
      {
        userAgent: LBC_DEFAULT_USER_AGENT,
        locale: 'fr-FR',
        timezoneId: 'Europe/Paris',
        viewport: { width: 1280, height: 800 },
      },
      (page) => this.runLoginFlow(page, email, password),
    );
  }

  private async runLoginFlow(
    page: Page,
    email: string,
    password: string,
  ): Promise<LoginResult> {
    let capturedBearer: string | null = null;
    let capturedRefreshToken: string | null = null;
    let capturedAccessToken: string | null = null;
    let loginFailed = false;

    page.on('request', (req) => {
      if (capturedBearer) return;
      if (!req.url().includes('api.leboncoin.fr')) return;
      const auth = req.headers()['authorization'];
      if (!auth?.startsWith('Bearer ')) return;
      const token = auth.slice(7);
      // Ne capturer que les Bearer qui ressemblent à un JWT (header.payload.signature) —
      // la home page LBC fait parfois des appels avec un token guest opaque
      if (token.split('.').length === 3) {
        capturedBearer = token;
      }
    });

    page.on('response', async (res) => {
      const url = res.url();
      if (url.includes('/api/authenticator/v2/users/login')) {
        if (res.status() >= 400) {
          loginFailed = true;
        }
        return;
      }
      if (!url.includes('auth.leboncoin.fr')) return;
      let body: unknown = null;
      try {
        body = await res.json();
      } catch {
        return;
      }
      if (body && typeof body === 'object') {
        const b = body as Record<string, unknown>;
        if (typeof b.access_token === 'string') {
          capturedAccessToken = b.access_token;
        }
        if (typeof b.refresh_token === 'string') {
          capturedRefreshToken = b.refresh_token;
        }
      }
    });

    // 1. Home page — pose les cookies initiaux + accepte Didomi
    await page.goto(LBC_WEB_HOST, { waitUntil: 'domcontentloaded' });
    const didomiClicked = await page
      .locator('#didomi-notice-agree-button')
      .click({ timeout: 8000 })
      .then(() => true)
      .catch(() => false);
    this.logger.log(`Didomi banner: ${didomiClicked ? 'accepté' : 'absent'}`);

    // 2. Construction de la même URL de login que celle générée par le bouton
    //    "Se connecter" : /login/?...&redirect_uri=<authorize URL avec state>
    const state = randomUUID();
    const authorizeUrl = this.buildAuthorizeUrl(state);
    const loginUrl = new URL(LBC_LOGIN_PAGE);
    loginUrl.searchParams.set('client_id', LBC_CLIENT_ID);
    loginUrl.searchParams.set('redirect_uri', authorizeUrl);
    loginUrl.searchParams.set('from_to', `${LBC_WEB_HOST}/`);
    await page.goto(loginUrl.toString(), { waitUntil: 'domcontentloaded' });
    this.logger.log(`Page de login chargée: ${page.url()}`);

    // 3. Form 2-step : email → Continuer → password → submit
    const emailLocator = page
      .locator(
        'input[type="email"], input[name="email"], input[autocomplete="username"]',
      )
      .first();
    try {
      await emailLocator.waitFor({ timeout: 15000 });
    } catch (err) {
      await this.browser.dumpDebug(page, 'email-input-timeout');
      throw err;
    }
    await emailLocator.fill(email);

    await page
      .getByRole('button', { name: /continuer/i })
      .click({ timeout: 4000 })
      .catch(() => undefined);

    const passwordLocator = page
      .locator('input[type="password"], input[name="password"]')
      .first();
    await passwordLocator.waitFor({ timeout: 10000 });
    await passwordLocator.fill(password);

    // Enregistre l'écoute du token endpoint AVANT submit pour éviter toute race.
    const tokenResponsePromise = page
      .waitForResponse(
        (res) =>
          res.url().includes('/api/authorizer/v2/token') &&
          res.status() === 200,
        { timeout: 30000 },
      )
      .catch(() => null);

    await page.locator('button[type="submit"]').first().click();

    // 4. Attendre soit le retour sur www.leboncoin.fr (succès), soit une 401 du login (mauvais creds)
    try {
      await page.waitForURL(/www\.leboncoin\.fr/, { timeout: 30000 });
    } catch {
      await this.browser.dumpDebug(page, 'post-login-timeout');
      if (loginFailed) {
        throw new UnauthorizedException(
          'Email ou mot de passe Leboncoin invalide',
        );
      }
      throw new InternalServerErrorException(
        'Timeout sur le redirect post-login. DataDome challenge ?',
      );
    }

    // 5. Attendre que le token endpoint réponde (issuance access+refresh)
    const tokenResponse = await tokenResponsePromise;
    if (tokenResponse) {
      try {
        const body = (await tokenResponse.json()) as {
          access_token?: string;
          refresh_token?: string;
        };
        if (body.access_token) capturedAccessToken = body.access_token;
        if (body.refresh_token) capturedRefreshToken = body.refresh_token;
      } catch (e) {
        this.logger.warn(
          `Parse token response échoué: ${(e as Error).message}`,
        );
      }
    }

    // 6. Attendre qu'un appel API authentifié soit parti (porte le Bearer)
    await page
      .waitForRequest(
        (req) =>
          req.url().includes('api.leboncoin.fr') &&
          !!req.headers()['authorization'],
        { timeout: 20000 },
      )
      .catch(() => undefined);

    if (!capturedBearer && capturedAccessToken) {
      capturedBearer = capturedAccessToken;
    }
    if (!capturedBearer) {
      await this.browser.dumpDebug(page, 'no-bearer');
      throw new InternalServerErrorException(
        'JWT non capturé après login Leboncoin',
      );
    }

    // 7. Fallback : si le refresh_token n'est pas venu via le token endpoint, le chercher en localStorage
    if (!capturedRefreshToken) {
      capturedRefreshToken = await this.findRefreshTokenInStorage(page);
    }
    if (!capturedRefreshToken) {
      await this.browser.dumpDebug(page, 'no-refresh-token');
      throw new InternalServerErrorException(
        'refresh_token non capturé après login Leboncoin',
      );
    }

    const cookies = await page.context().cookies();
    const datadome = cookies.find((c) => c.name === 'datadome')?.value;
    if (!datadome) {
      throw new InternalServerErrorException(
        'Cookie datadome absent — la session ne tiendrait pas',
      );
    }
    // __Secure-Login : HttpOnly cookie qui identifie la session côté serveur.
    // Indispensable pour appeler le logout endpoint plus tard.
    const secureLogin = cookies.find((c) => c.name === '__Secure-Login')?.value;

    const { accountId, expiresAt } = this.parseJwt(capturedBearer);

    // Fetch /me/account pour récupérer le téléphone — utile au publish.
    // Best-effort : si la call rate, on continue sans phone (publish enverra null).
    const phone = await this.fetchPhoneNumber(
      capturedBearer,
      datadome,
      LBC_DEFAULT_USER_AGENT,
    ).catch((err: Error) => {
      this.logger.warn(`Fetch /me/account échoué: ${err.message}`);
      return undefined;
    });

    return {
      credentials: {
        accessToken: capturedBearer,
        refreshToken: capturedRefreshToken,
        datadomeCookie: datadome,
        secureLoginCookie: secureLogin,
        userAgent: LBC_DEFAULT_USER_AGENT,
      },
      externalUserId: accountId,
      tokenExpiresAt: expiresAt,
      phone,
    };
  }

  /** Récupère le numéro de téléphone du compte LBC via /me/account. */
  private async fetchPhoneNumber(
    accessToken: string,
    datadomeCookie: string,
    userAgent: string,
  ): Promise<string | undefined> {
    const res = await this.http.request({
      method: 'GET',
      url: LBC_ME_ACCOUNT_URL,
      label: 'lbc:me-account',
      headers: {
        ...buildLbcApiHeaders(userAgent),
        Authorization: `Bearer ${accessToken}`,
        Cookie: `datadome=${datadomeCookie}`,
      },
      timeout: 10_000,
    });
    if (res.status !== 200) {
      this.logger.warn(`/me/account HTTP ${res.status}`);
      return undefined;
    }
    const parsed = LbcMeAccountResponseSchema.safeParse(res.data);
    if (!parsed.success) {
      this.logger.warn(
        `/me/account body invalide: ${parsed.error.issues[0]?.message}`,
      );
      return undefined;
    }
    return extractPhoneNumber(parsed.data);
  }

  /**
   * Best-effort logout côté Leboncoin. Révoque la session serveur via le endpoint
   * /api/authenticator/v1/users/logout. Si le cookie __Secure-Login est absent
   * (account legacy), skip avec un warn — l'account sera quand même supprimé localement.
   * Ne throw jamais : la suppression locale doit toujours aboutir.
   */
  async logout(account: AccountDocument): Promise<void> {
    let creds: LeboncoinCredentials;
    try {
      creds = this.parseCredentials(account);
    } catch (err) {
      this.logger.warn(
        `Logout LBC: décryptage credentials échoué (${(err as Error).message}), skip remote revoke`,
      );
      return;
    }
    if (!creds.secureLoginCookie) {
      this.logger.warn(
        `Logout LBC: account ${account._id.toString()} sans secureLoginCookie (legacy), skip remote revoke`,
      );
      return;
    }
    const url = new URL(LBC_LOGOUT_ENDPOINT);
    url.searchParams.set('client_id', LBC_CLIENT_ID);
    url.searchParams.set('redirect_uri', LBC_WEB_HOST);
    try {
      await this.http.request({
        method: 'GET',
        url: url.toString(),
        label: `lbc:logout:${account._id.toString().slice(-6)}`,
        headers: {
          ...buildLbcApiHeaders(creds.userAgent),
          Accept:
            'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          Cookie: [
            `__Secure-Login=${creds.secureLoginCookie}`,
            `__Secure-Login-Lax=${creds.secureLoginCookie}`,
            `datadome=${creds.datadomeCookie}`,
          ].join('; '),
        },
        timeout: 15_000,
      });
    } catch (err) {
      this.logger.warn(
        `Logout LBC HTTP échoué pour ${account.email}: ${(err as Error).message}`,
      );
    }
  }

  /**
   * Garantit que les credentials de l'account sont valides : refresh HTTP pur
   * si le JWT expire dans moins de LBC_JWT_REFRESH_SKEW_MS.
   * Marque l'account needsReconnect si le refresh est révoqué.
   */
  async ensureValidToken(
    account: AccountDocument,
  ): Promise<LeboncoinCredentials> {
    const creds = this.parseCredentials(account);
    const remainingMs = account.tokenExpiresAt.getTime() - Date.now();
    if (remainingMs > LBC_JWT_REFRESH_SKEW_MS) {
      return creds;
    }

    this.logger.log(
      `JWT expire dans ${Math.round(remainingMs / 1000)}s, refresh pour account ${account._id.toString()}`,
    );

    try {
      const refreshed = await this.refreshAccessToken(
        creds.refreshToken,
        creds.userAgent,
        creds.datadomeCookie,
      );
      const updated: LeboncoinCredentials = {
        ...creds,
        accessToken: refreshed.accessToken,
        refreshToken: refreshed.refreshToken,
      };
      await this.store.updateCredentials(
        account._id,
        updated,
        refreshed.expiresAt,
      );
      account.tokenExpiresAt = refreshed.expiresAt;
      return updated;
    } catch (err) {
      this.logger.error(
        `Refresh JWT échoué pour account ${account._id.toString()}: ${(err as Error).message}`,
      );
      await this.store.markNeedsReconnect(account._id);
      throw new UnauthorizedException(
        'Session Leboncoin expirée, reconnexion nécessaire',
      );
    }
  }

  parseCredentials(account: AccountDocument): LeboncoinCredentials {
    const raw = this.store.decryptCredentials(account);
    return LeboncoinCredentialsSchema.parse(raw);
  }

  /** Cherche refresh_token dans localStorage (fallback si le token endpoint a été manqué). */
  private async findRefreshTokenInStorage(page: Page): Promise<string | null> {
    try {
      const ls = await page.evaluate(() =>
        Object.fromEntries(Object.entries(localStorage)),
      );
      for (const [, value] of Object.entries(ls)) {
        if (typeof value !== 'string') continue;
        const fromJson = this.tryExtractRefreshToken(value);
        if (fromJson) return fromJson;
        // JWT-like brut (header.payload.signature)
        if (value.split('.').length === 3 && value.length > 100) {
          return value;
        }
      }
    } catch (e) {
      this.logger.warn(`Lecture localStorage échouée: ${(e as Error).message}`);
    }
    return null;
  }

  /** Parse une string JSON et extrait `refresh_token` si présent, sinon null. */
  private tryExtractRefreshToken(value: string): string | null {
    let json: unknown;
    try {
      json = JSON.parse(value);
    } catch {
      return null;
    }
    const result = RefreshTokenContainerSchema.safeParse(json);
    return result.success ? result.data.refresh_token : null;
  }

  private async refreshAccessToken(
    refreshToken: string,
    userAgent: string,
    datadomeCookie: string,
  ): Promise<{ accessToken: string; refreshToken: string; expiresAt: Date }> {
    const body = new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
      client_id: LBC_CLIENT_ID,
    }).toString();

    const res = await this.http.request<{
      access_token?: string;
      refresh_token?: string;
    }>({
      method: 'POST',
      url: LBC_TOKEN_ENDPOINT,
      data: body,
      label: 'lbc:refresh',
      headers: {
        ...buildLbcApiHeaders(userAgent),
        'Content-Type': 'application/x-www-form-urlencoded',
        Cookie: `datadome=${datadomeCookie}`,
      },
      timeout: 15_000,
    });

    if (res.status !== 200 || !res.data?.access_token) {
      throw new Error(
        `Refresh HTTP ${res.status} : ${JSON.stringify(res.data)?.slice(0, 200)}`,
      );
    }

    const { expiresAt } = this.parseJwt(res.data.access_token);
    return {
      accessToken: res.data.access_token,
      refreshToken: res.data.refresh_token ?? refreshToken,
      expiresAt,
    };
  }

  private buildAuthorizeUrl(state: string): string {
    const url = new URL(LBC_AUTHORIZE_ENDPOINT);
    url.searchParams.set('client_id', LBC_CLIENT_ID);
    url.searchParams.set('redirect_uri', LBC_OAUTH_REDIRECT_URI);
    url.searchParams.set('response_type', 'code');
    url.searchParams.set('scope', LBC_OAUTH_SCOPE);
    url.searchParams.set('state', state);
    return url.toString();
  }

  private parseJwt(jwt: string): { accountId: string; expiresAt: Date } {
    const segments = jwt.split('.');
    if (segments.length !== 3) {
      throw new InternalServerErrorException(
        `Token capturé n'est pas un JWT valide (${segments.length} segments au lieu de 3): "${jwt.slice(0, 40)}..."`,
      );
    }
    const payloadB64 = segments[1];
    const padded = payloadB64 + '='.repeat((4 - (payloadB64.length % 4)) % 4);
    const payload = JSON.parse(
      Buffer.from(padded, 'base64url').toString('utf8'),
    ) as JwtPayload;
    if (!payload.account_id || !payload.exp) {
      throw new InternalServerErrorException(
        `JWT décodé manque account_id ou exp: ${JSON.stringify(payload)}`,
      );
    }
    return {
      accountId: payload.account_id,
      expiresAt: new Date(payload.exp * 1000),
    };
  }
}
