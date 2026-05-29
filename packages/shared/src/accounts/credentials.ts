import { z } from 'zod';

/**
 * Schéma des credentials Leboncoin stockés (chiffrés) dans Account.credentialsEnc.
 * Capturés lors du login Playwright one-shot, rejoués en HTTP pur pour les API calls.
 */
export const LeboncoinCredentialsSchema = z.object({
  accessToken: z.string(),
  refreshToken: z.string(),
  datadomeCookie: z.string(),
  // __Secure-Login cookie (JWT HS512 émis par auth.leboncoin.fr), nécessaire pour le logout.
  // Optionnel pour rétrocompat avec des comptes connectés avant la mise à jour.
  secureLoginCookie: z.string().optional(),
  userAgent: z.string(),
});
export type LeboncoinCredentials = z.infer<typeof LeboncoinCredentialsSchema>;

/**
 * Schéma des credentials Vinted stockés (chiffrés) dans Account.credentialsEnc.
 * Vinted est cookie-based : l'auth vit dans les cookies (access/refresh/session)
 * posés au login, rejoués en HTTP pur pour les API calls (+ x-csrf-token / x-anon-id).
 */
export const VintedCredentialsSchema = z.object({
  // JWT cookie `access_token_web` (purpose=access, ~2h)
  accessToken: z.string(),
  // JWT cookie `refresh_token_web` (purpose=refresh, ~7j)
  refreshToken: z.string(),
  // Cookie `_vinted_fr_session` (session serveur)
  sessionCookie: z.string(),
  // Cookie `datadome` (anti-bot, lié au device)
  datadomeCookie: z.string().optional(),
  // Cookie `cf_clearance` (Cloudflare) — peut être absent en login HTTP pur
  cfClearanceCookie: z.string().optional(),
  // Cookie `anon_id` — renvoyé en header `x-anon-id` sur les API calls
  anonId: z.string().optional(),
  // Token CSRF (header `x-csrf-token`) capturé au login
  csrfToken: z.string(),
  userAgent: z.string(),
});
export type VintedCredentials = z.infer<typeof VintedCredentialsSchema>;
