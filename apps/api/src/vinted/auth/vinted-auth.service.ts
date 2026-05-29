import {
  Injectable,
  Logger,
  InternalServerErrorException,
  UnauthorizedException,
} from '@nestjs/common';
import type { Page } from 'playwright';
import {
  VintedCredentialsSchema,
  type VintedCredentials,
} from '@crosspost/shared';
import { BrowserService } from '../../browser/browser.service.js';
import {
  VINTED_DEFAULT_USER_AGENT,
  VINTED_HOME_URL,
} from '../vinted-platform.config.js';
import type { AccountDocument } from '../../accounts/schemas/account.schema.js';
import type {
  PlatformAuthAdapter,
  PlatformLoginResult,
} from '../../accounts/platform-auth.types.js';

interface VintedJwtPayload {
  sub?: string;
  account_id?: number;
  exp?: number;
  anid?: string;
  [k: string]: unknown;
}

/**
 * Auth Vinted via Playwright (le login HTTP pur est bloqué par DataDome au POST
 * /web/api/auth/oauth → captcha). Le navigateur passe le challenge JS, on capture
 * ensuite les cookies (access/refresh/session/datadome/cf_clearance) + le CSRF.
 * Le sync/publish se fera ensuite en HTTP pur en rejouant ces credentials.
 */
@Injectable()
export class VintedAuthService implements PlatformAuthAdapter {
  private readonly logger = new Logger(VintedAuthService.name);

  constructor(private readonly browser: BrowserService) {}

  async loginWithPassword(
    email: string,
    password: string,
  ): Promise<PlatformLoginResult> {
    return this.browser.withPage(
      {
        userAgent: VINTED_DEFAULT_USER_AGENT,
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
  ): Promise<PlatformLoginResult> {
    let oauthStatus: number | null = null;
    let capturedCsrf: string | null = null;

    // Diagnostic : qui ferme la page ?
    page.on('close', () => this.logger.warn('>>> PAGE close event'));
    page.on('crash', () => this.logger.warn('>>> PAGE crash event'));
    page.on('framenavigated', (f) => {
      if (f === page.mainFrame()) this.logger.log(`>>> nav: ${f.url()}`);
    });

    // Capture la requête/réponse oauth (source de vérité du succès du login).
    page.on('request', (req) => {
      if (req.url().includes('/web/api/auth/oauth')) {
        const csrf = req.headers()['x-csrf-token'];
        if (csrf) capturedCsrf = csrf;
      }
    });
    page.on('response', (res) => {
      if (res.url().includes('/web/api/auth/oauth')) {
        oauthStatus = res.status();
      }
    });

    // 1. Home (networkidle → le header React est hydraté)
    await page.goto(VINTED_HOME_URL, { waitUntil: 'domcontentloaded' });

    // Consentement OneTrust (injecté en JS, peut tarder)
    await page
      .locator('#onetrust-accept-btn-handler')
      .click({ timeout: 10000 })
      .then(() => this.logger.log('Bandeau cookies accepté'))
      .catch(() => this.logger.log('Bandeau cookies absent'));

    // 2. Ouvrir la page d'auth (navigue vers /member/signup/select_type, vue inscription)
    await this.openAuthModal(page);

    // 3a. Basculer vue inscription → connexion (toggle client-side, avec retry)
    await this.switchToLoginView(page);

    // 3b. Cliquer la méthode e-mail (vue connexion)
    const emailMethod = page
      .locator('[data-testid="auth-select-type--login-email"]')
      .first();
    await emailMethod.click();
    this.logger.log('Méthode e-mail (connexion) sélectionnée');

    // 4. Remplir le formulaire
    const emailInput = page
      .locator(
        'input[type="email"], input[name="email"], input[name="username"], #username',
      )
      .first();
    try {
      await emailInput.waitFor({ timeout: 15000 });
    } catch (err) {
      await this.browser.dumpDebug(page, 'vinted-no-email-input');
      throw new InternalServerErrorException(
        'Champ email Vinted introuvable — sélecteur de modale à ajuster.',
      );
    }
    await emailInput.fill(email);
    await page
      .locator('input[type="password"], input[name="password"], #password')
      .first()
      .fill(password);

    // 5. Submit + attendre la réponse oauth
    const oauthResponse = page
      .waitForResponse(
        (res) => res.url().includes('/web/api/auth/oauth'),
        { timeout: 30000 },
      )
      .catch(() => null);
    // Bouton submit du form login = "Continuer" (type submit, sans testid)
    await page
      .getByRole('button', { name: /^continuer$/i })
      .first()
      .click();
    this.logger.log('Formulaire soumis');
    await oauthResponse;

    if (oauthStatus && oauthStatus >= 400) {
      await this.browser.dumpDebug(page, 'vinted-oauth-failed');
      throw new UnauthorizedException(
        `Login Vinted refusé (oauth HTTP ${oauthStatus}) — identifiants ou captcha.`,
      );
    }

    // 6. Laisser le temps aux cookies de se poser, puis les lire
    await page.waitForTimeout(1500);
    const cookies = await page.context().cookies();
    const cookieVal = (name: string) =>
      cookies.find((c) => c.name === name)?.value;

    const accessToken = cookieVal('access_token_web');
    const refreshToken = cookieVal('refresh_token_web');
    const sessionCookie = cookieVal('_vinted_fr_session');

    if (!accessToken || !refreshToken || !sessionCookie) {
      await this.browser.dumpDebug(page, 'vinted-no-tokens');
      throw new InternalServerErrorException(
        `Tokens Vinted absents après login (access=${!!accessToken}, refresh=${!!refreshToken}, session=${!!sessionCookie}).`,
      );
    }

    // CSRF : header capturé sinon extrait du HTML
    const csrfToken =
      capturedCsrf ?? extractCsrfToken(await page.content());
    if (!csrfToken) {
      throw new InternalServerErrorException(
        'CSRF token Vinted non capturé.',
      );
    }

    const payload = decodeJwt(accessToken);
    const externalUserId = payload.sub;
    if (!externalUserId) {
      throw new InternalServerErrorException(
        'JWT Vinted sans `sub` (user id).',
      );
    }
    const tokenExpiresAt = payload.exp
      ? new Date(payload.exp * 1000)
      : new Date(Date.now() + 2 * 60 * 60 * 1000);

    const credentials: VintedCredentials = VintedCredentialsSchema.parse({
      accessToken,
      refreshToken,
      sessionCookie,
      datadomeCookie: cookieVal('datadome'),
      cfClearanceCookie: cookieVal('cf_clearance'),
      anonId: cookieVal('anon_id') ?? payload.anid,
      csrfToken,
      userAgent: VINTED_DEFAULT_USER_AGENT,
    });

    this.logger.log(
      `Login Vinted OK — user ${externalUserId} (account_id=${payload.account_id ?? '?'})`,
    );
    return { credentials, externalUserId, tokenExpiresAt };
  }

  /** Ouvre la page d'auth via le bouton SSR `header--login-button`, et attend que select_type soit stabilisé. */
  private async openAuthModal(page: Page): Promise<void> {
    const loginBtn = page
      .locator('[data-testid="header--login-button"]')
      .first();
    try {
      await loginBtn.waitFor({ state: 'visible', timeout: 20000 });
      await loginBtn.click();
    } catch {
      await this.browser.dumpDebug(page, 'vinted-no-login-button');
      throw new InternalServerErrorException(
        'Bouton login Vinted (header--login-button) introuvable/cliquable.',
      );
    }
    // Attendre que la page select_type soit chargée ET hydratée (sinon le toggle
    // suivant part trop tôt et la nav réinitialise la vue sur "inscription").
    await page.waitForURL(/select_type/, { timeout: 15000 }).catch(() => undefined);
    await page.waitForLoadState('networkidle').catch(() => undefined);
    await page
      .locator('[data-testid="select-type-register-view"]')
      .waitFor({ state: 'visible', timeout: 10000 })
      .catch(() => undefined);
    this.logger.log('Page select_type chargée (vue inscription)');
  }

  /**
   * Bascule register → login et confirme via l'apparition de `login-email`.
   * Le toggle est un span[role=button] client-side ; on retry si la vue ne change pas.
   */
  private async switchToLoginView(page: Page): Promise<void> {
    const loginEmail = page.locator(
      '[data-testid="auth-select-type--login-email"]',
    );
    const toggle = page.locator(
      '[data-testid="auth-select-type--register-switch"]',
    );
    for (let attempt = 1; attempt <= 3; attempt++) {
      await toggle
        .waitFor({ state: 'visible', timeout: 8000 })
        .catch(() => undefined);
      await toggle.click().catch(() => undefined);
      this.logger.log(`Toggle "Se connecter" (essai ${attempt})`);
      const switched = await loginEmail
        .waitFor({ state: 'visible', timeout: 5000 })
        .then(() => true)
        .catch(() => false);
      if (switched) {
        this.logger.log('Vue connexion confirmée');
        return;
      }
    }
    await this.browser.dumpDebug(page, 'vinted-switch-failed');
    throw new InternalServerErrorException(
      'Bascule vers la vue connexion échouée (login-email jamais visible).',
    );
  }

  /** Best-effort — pas de révocation côté Vinted pour l'instant. Ne throw jamais. */
  async logout(_account: AccountDocument): Promise<void> {
    return;
  }
}

// ─── Helpers ────────────────────────────────────────────────────────────────

/** Cherche le CSRF token (UUID) dans le HTML (blob JSON, quotes échappées). */
function extractCsrfToken(html: string): string | undefined {
  const uuid =
    '[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}';
  const patterns = [
    new RegExp(`CSRF_TOKEN["\\\\:\\s]+(${uuid})`, 'i'),
    new RegExp(`csrf[_-]?token["'\\\\:\\s]+(${uuid})`, 'i'),
  ];
  for (const re of patterns) {
    const m = html.match(re);
    if (m?.[1]) return m[1];
  }
  return undefined;
}

/** Décode le payload d'un JWT (sans vérif de signature). */
function decodeJwt(jwt: string): VintedJwtPayload {
  const segments = jwt.split('.');
  if (segments.length !== 3) {
    throw new InternalServerErrorException(
      `Token Vinted non-JWT (${segments.length} segments).`,
    );
  }
  const b64 = segments[1];
  const padded = b64 + '='.repeat((4 - (b64.length % 4)) % 4);
  return JSON.parse(
    Buffer.from(padded, 'base64url').toString('utf8'),
  ) as VintedJwtPayload;
}
