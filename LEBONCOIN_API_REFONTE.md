# Refonte Leboncoin — API-only

> Ce document remplace `PLAN.md` (qui décrit l'archi Playwright + VNC + scraping DOM, désormais abandonnée pour Leboncoin).

## Pourquoi cette refonte

Inspection des requêtes réelles de `leboncoin.fr` (DevTools) → l'API LBC utilise un modèle **OAuth 2.0 Authorization Code + JWT Bearer**, pas du tout du cookie-de-session-web :

- `Authorization: Bearer <JWT>` (issuer `auth.leboncoin.fr`, `client_id: lbc-front-web`, scope `lbc.*.me.* offline`, exp 2h)
- Cookie `datadome` (protection antibot)
- Toutes les opérations user (sync, publish, edit, archive) → `api.leboncoin.fr/api/...`
- Publish = chaîne de 4-5 API calls bien définie

→ On peut **virer entièrement Playwright + VNC** pour Leboncoin et basculer sur du HTTP pur. Énorme gain de perf, de simplicité, et de fiabilité (plus de selectors DOM cassables).

## Découvertes confirmées

### Flow OAuth 2.0

```
POST <login endpoint sur auth.leboncoin.fr>
  body: { email, password }
  →
  body: {
    redirect_uri: "https://auth.leboncoin.fr/api/authorizer/v2/authorize
                    ?client_id=lbc-front-web
                    &login_status=OK
                    &redirect_uri=https%3A%2F%2Fwww.leboncoin.fr%2Foauth2callback
                    &response_type=code
                    &scope=*+offline
                    &state=<uuid>",
    login_status: "OK",
    user_id: "..."
  }
  + Set-Cookie session (sur auth.leboncoin.fr)

GET <redirect_uri> (avec cookie session)
  → 302 Location: https://www.leboncoin.fr/oauth2callback?code=<code>&state=<state>

POST <token endpoint>  (à découvrir — probablement auth.leboncoin.fr/api/oauth/.../token)
  body: { grant_type: "authorization_code", code, state, client_id, redirect_uri }
  →
  body: { access_token (JWT), refresh_token, expires_in: 7200 }
```

### Antibot — DataDome confirmé bloquant sur le login

Test empirique (curl manuel sur `POST /api/authenticator/v2/users/login` avec cookies réels mais sans `login-id` / `x-fingerprint`) → réponse `{"url":"https://geo.captcha-delivery.com/captcha/..."}` = challenge DataDome immédiat.

Les headers `login-id` (HMAC signé client-side) et `x-fingerprint` (empreinte canvas/WebGL) sont **obligatoires** et générés par le JS bundle LBC. Impossibles à recalculer sans exécuter leur JS.

**Décision actée** : login = Playwright headless one-shot (un vrai Chrome qui exécute leur JS et génère naturellement ces tokens). Le browser tourne ~2-3s, on capture :
- le JWT Bearer (intercepté sur le premier call API authentifié)
- le cookie `datadome` (posé après le challenge JS)
- le `refresh_token` (probablement en localStorage)

Puis le browser ferme. Tout le reste (sync, publish, refresh) passe en HTTP pur avec ces credentials.

À valider lors du POC : les calls API ultérieurs (`api.leboncoin.fr`) acceptent-ils notre cookie `datadome` capturé sans re-challenge ? Probablement oui (c'est le pattern habituel), mais à confirmer empiriquement.

## Décisions actées

| Décision | Choix |
|---|---|
| Stockage password | One-shot, jamais persisté. Renouvellement via refresh_token chiffré. |
| Stratégie DataDome | **Playwright headless one-shot pour login** (confirmé bloquant en HTTP pur). HTTP pur pour le reste. |
| Scaling 0-100 users | Server-side sans proxies (IP propre Hetzner/OVH, pas AWS) |
| Scaling 100-1000+ users | Pool de proxies résidentiels sticky par compte (BrightData/Oxylabs) |
| Scaling : extension Chrome ? | **Éliminé** — nécessite PC user allumé pour automatisation 24/7 |
| Préparation scaling | HttpClient accepte une option proxy dès la v1 → bascule = feature flag, pas refacto |

## Architecture cible

```
apps/api/src/
├── leboncoin/                                ← nouveau module
│   ├── leboncoin.module.ts
│   ├── http/
│   │   ├── leboncoin-http.client.ts          ← axios + cookie jar + Bearer + proxy hook optionnel
│   │   └── leboncoin-headers.ts              ← user-agent + sec-ch-ua... centralisés
│   ├── auth/
│   │   ├── leboncoin-auth.service.ts         ← login (email/password → tokens), refresh, exchange code
│   │   ├── leboncoin-token-store.service.ts  ← persist access/refresh tokens + datadome chiffrés
│   │   └── leboncoin-oauth.types.ts
│   ├── publish/
│   │   └── leboncoin-publish.service.ts      ← chaîne des 4-5 API calls
│   ├── sync/
│   │   └── leboncoin-sync.service.ts         ← GET /api/dashboard/v1/search
│   └── leboncoin-platform.config.ts          ← URLs, client_id, scopes
│
├── accounts/
│   ├── accounts.controller.ts                ← POST /accounts/connect synchrone (email+password)
│   ├── accounts.service.ts                   ← orchestre login + persist
│   └── schemas/account.schema.ts             ← {userId, platform, email, accessTokenEnc, refreshTokenEnc, datadomeCookieEnc, jwtExpiresAt, isConnected}
│
├── publish/
│   ├── publish.service.ts                    ← orchestrateur plateforme-agnostique
│   ├── publish.controller.ts
│   └── publish.module.ts                     ← map {Platform → publisher}
│
├── sync/
│   ├── sync.service.ts                       ← orchestrateur plateforme-agnostique
│   └── sync.module.ts
│
└── queues/
    ├── publish.queue.ts                      ← BullMQ throttled par accountId
    └── publish.processor.ts
```

## Cleanup à faire (backend from scratch)

À supprimer entièrement :
- `apps/browser/` — tout le worker browser (Playwright + VNC)
- `apps/web/src/components/VncViewer.vue`
- `packages/shared/src/jobs/browser-jobs.ts` (types BullMQ browser)
- Toute la logique SSE de `/accounts/connect` (devient synchrone)

À refacto en profondeur :
- `apps/api/src/accounts/accounts.service.ts` — base saine
- `apps/api/src/accounts/schemas/account.schema.ts` — nouveau shape (tokens + datadome)
- `apps/api/src/publish/publish.service.ts` — orchestrateur fin
- `apps/api/src/sync/sync.service.ts` — orchestrateur fin
- `apps/web/src/views/AccountsView.vue` — formulaire email/password simple

À conserver :
- BullMQ (file de publications throttlée)
- `EncryptionService` (chiffre maintenant tokens + datadome au lieu de cookies)
- NestJS + Zod + nestjs-zod
- MongoDB + Mongoose
- Vue 3 / Vuetify

## Throttling BullMQ

Limit per-compte, pas global : un compte ne publie pas plus d'1 fois toutes les 3 min, mais plusieurs comptes publient en parallèle.

```ts
new Worker(
  'publish',
  async (job) => publishProcessor.handle(job),
  {
    connection,
    limiter: {
      max: 1,
      duration: 3 * 60 * 1000,
      groupKey: 'accountId',
    },
    concurrency: 5,
  },
);

await publishQueue.add(
  'publish-listing',
  { listingId, accountId, platform },
  { group: { id: accountId } },
);
```

Paramètres initiaux conservateurs (3 min, concurrency 5). À tuner selon le feedback DataDome.

## Flow de connexion (UX cible)

```
[Web]                          [API]                        [Leboncoin]
 │ POST /accounts/connect       │                             │
 │ { email, password }          │                             │
 │ ───────────────────────────► │                             │
 │                              │ POST auth login             │
 │                              │ ───────────────────────────►│
 │                              │ ◄─── {redirect_uri} + cookie│
 │                              │ GET redirect_uri            │
 │                              │ ───────────────────────────►│
 │                              │ ◄─── 302 ?code=...          │
 │                              │ POST token exchange         │
 │                              │ ───────────────────────────►│
 │                              │ ◄─── {access_token, refresh}│
 │                              │ Chiffre + persist DB        │
 │ 201 { accountId, email }     │                             │
 │ ◄─────────────────────────── │                             │
```

Pas d'SSE, pas de polling, pas de VNC. Erreur 401 → propagée tel quel au front.

## Refresh JWT

- Avant chaque appel API, vérifier `jwtExpiresAt`. Si expire dans <60s → refresh.
- Endpoint refresh : probablement `POST auth.leboncoin.fr/.../token` avec `grant_type: refresh_token`.
- Si refresh échoue (token révoqué) → `account.isConnected = false` + UI redemande password.

## Roadmap d'exécution

### Étape 1 — POC auth jetable
Script `apps/api/scripts/leboncoin-auth-poc.ts` :
1. **Playwright headless** : navigate sur `auth.leboncoin.fr/login`, fill credentials, submit. Intercepte le Bearer JWT + capture cookies (`datadome` notamment) + localStorage (`refresh_token`).
2. **axios HTTP pur** : POST `api.leboncoin.fr/api/dashboard/v1/search` avec les creds capturés. Confirme qu'on n'a plus besoin de browser pour les calls API ultérieurs.

### Étape 2 — Module Leboncoin + connexion
Création `apps/api/src/leboncoin/`, migration schéma `Account`, endpoint `POST /accounts/connect` synchrone, refacto `AccountsView.vue`, suppression VNC + `apps/browser`.

### Étape 3 — Sync API
`LeboncoinSyncService` sur `GET api.leboncoin.fr/api/dashboard/v1/search`. Branchement dans `SyncService`.

### Étape 4 — Publish API
Inspection DevTools du flow réel → `LeboncoinPublishService` (chaîne des 4-5 calls).

### Étape 5 — File BullMQ throttlée
Rate limiter `groupKey: 'accountId'`, params initiaux 1/3min, concurrency 5.

## Hors scope de cette refonte

- Vinted, Marketplace, eBay (archi extensible mais pas implémentée ici)
- Captcha solver / pool de cookies datadome warm
- Détection compte banni → notif user
- 2FA Leboncoin (à voir si on tombe dessus)
- Tests automatisés du flow auth

## Vérification end-to-end

Une fois les 5 étapes terminées :
1. User connecte un compte LBC via formulaire (Étape 2)
2. Liste annonces apparaît en <2s vs 10-30s avant (Étape 3)
3. 3 annonces enqueue → publications espacées de 3 min, succès LBC (Étapes 4+5)
4. Attendre 2h+ → refresh JWT silencieux, publication suivante OK
5. Refresh totalement expiré → UI redemande password proprement
