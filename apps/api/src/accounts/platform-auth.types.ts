import type { AccountDocument } from './schemas/account.schema.js';

/**
 * Résultat du login one-shot, identique pour toutes les plateformes.
 * Le shape de `credentials` varie par plateforme — chacune a son Zod schema dans `@crosspost/shared`.
 */
export interface PlatformLoginResult {
  credentials: unknown;
  externalUserId: string;
  tokenExpiresAt: Date;
  /** Téléphone du vendeur, si la plateforme l'expose après login (LBC : /me/account). */
  phone?: string;
}

/**
 * Contrat que chaque service d'auth platform-specific doit implémenter.
 * Permet à `AccountsService` de dispatcher uniformément (connect, logout, ...).
 */
export interface PlatformAuthAdapter {
  /** Login one-shot via browser. Capture les credentials + ID externe + expiration. */
  loginWithPassword(
    email: string,
    password: string,
  ): Promise<PlatformLoginResult>;

  /**
   * Best-effort logout côté plateforme distante. Ne doit pas throw —
   * on supprime le compte localement quoi qu'il arrive.
   */
  logout(account: AccountDocument): Promise<void>;
}
