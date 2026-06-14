# Tests backend — plan & suivi

Objectif : un filet anti-régression sur l'API (`apps/api`). On démarre par le
backend uniquement. Pondération par ROI réel, pas pyramide dogmatique.

## Stack de test

- **Jest + ts-jest** (déjà configuré, config inline dans `package.json`).
- **@nestjs/testing** (`Test.createTestingModule`) pour la DI des services.
- **supertest** pour les tests e2e HTTP.
- Scripts : `pnpm --filter @crosspost/api test` (unit), `test:cov` (couverture),
  `test:e2e` (e2e).

### ⚠️ Point de socle critique — résolution des imports `.js`

Le code source est en ESM `nodenext` : les imports internes portent l'extension
`.js` (`import { X } from './x.js'`). ts-jest tourne en CommonJS et **ne résout
pas** ces specifiers → "Cannot find module './x.js'".

Fix en place (ne pas retirer) — `moduleNameMapper` dans la config jest unit
(`package.json`) **et** e2e (`test/jest-e2e.json`) :

```json
"moduleNameMapper": { "^(\\.{1,2}/.*)\\.js$": "$1" }
```

## Conventions

- `*.spec.ts` **à côté** du fichier testé (unit + service).
- `*.e2e-spec.ts` dans `test/` (e2e, config dédiée `jest-e2e.json`).
- Tests en français (libellés `describe`/`it`), code en anglais — cohérent repo.
- Schémas Zod partagés (`@crosspost/shared`) : testés depuis `apps/api` (le
  runner y est déjà configuré, pas de second setup jest).
- **Ne jamais** taper en vrai : Playwright, APIs marketplace (DataDome), LLM, S3.
  Toujours mocker.

## Règle CI

`pnpm -r test` doit passer avant tout merge. C'est ça, la non-régression.

---

## Phase 0 — Socle ✅ FAIT

- [x] Vérifier que la suite jest tourne.
- [x] Corriger la résolution des imports `.js` (`moduleNameMapper`, unit + e2e).
- [x] Fixer les conventions de nommage/emplacement.

## Phase 1 — Logique pure ✅ FAIT (68 tests)

- [x] `listings/listing-title.util.spec.ts` — `normalizeTitle` (dédup cross-plateforme).
- [x] `vinted/catalog/vinted-catalog.utils.spec.ts` — `flattenLeaves`, `findNodeById`, `countByDepth`.
- [x] `common/crypto/encryption.service.spec.ts` — round-trip AES-GCM, altération, rotation de clé.
- [x] `leboncoin/sync/leboncoin-category.mapper.spec.ts` — règles déterministes, fallback LLM (mocké), cache.
- [x] `listings/dto/listing.dto.spec.ts` — `createListingSchema`, `listingQuerySchema` (coercion, defaults, `arrayQueryParam`).
- [x] `settings/dto/settings.dto.spec.ts` — `bumpConfigSchema` (bornes), `updateSettingsSchema` (union location).
- [ ] `dto/publication.dto` (schéma partagé) — **reste à faire** pour la complétude.

## Phase 2 — Services orchestration ⬜ À FAIRE

Outils à ajouter : `mongodb-memory-server` (intégration Mongo réelle),
décider Redis pour le lock (`ioredis-mock` ou Redis local).

- [ ] `publish/publish-lock.service` — `acquire`/`release`/`cooldown`/`pttl` ;
      surtout le **check-and-del** (on ne libère que SON token, pas celui d'un
      autre acquéreur après expiration TTL). Redis mocké ou local.
- [ ] `publications/publications.service` — dedup/upsert (**index unique
      `{listingId, accountId, platform}`**), `findDueBumps` (cutoff, ownership,
      exclusion des vendues), `remove` (ownership). → `mongodb-memory-server`
      (mocker le `Model` ne testerait que le mock, surtout pour l'index unique).
- [ ] `listings/listings.service` — diff média à l'update (suppression des
      images orphelines), calcul `mediaUrls` (S3 mocké).

## Phase 3 — Flux & garde-fous ⬜ À FAIRE (optionnel, plus tard)

- [ ] `publish/publish.processor` — defer quand le lock est pris, cooldown en
      mode `bump`, release en cas d'erreur (Job BullMQ mocké).
- [ ] `bump/bump.scheduler` — enregistrement idempotent du job répétable au boot.
- [ ] 1–2 tests e2e `supertest` sur un endpoint clé (auth guard + ZodValidationPipe),
      Mongo-in-memory, le reste mocké.
- [ ] Nettoyer/remplacer le boilerplate `app.controller.spec.ts` + `app.e2e-spec.ts`
      (testent l'endpoint "Hello World!").

---

## Trouvailles / dette à arbitrer

- **Regex catégorie LBC ne couvre pas le circonflexe.** `leboncoin-category.mapper`
  utilise `v[ée]tement` : la classe `[ée]` n'inclut pas `ê`. Le libellé réel LBC
  « Vêtements » ne matche donc jamais le fast-path et part vers le LLM (coût +
  non-déterminisme). Idem `accessoires? &` rate « & Accessoires » (ordre inversé).
  Documenté par un test garde-fou dans `leboncoin-category.mapper.spec.ts`
  ("trou connu"). → Décider si on élargit la regex (`v[éèê]tement`) ; si oui,
  inverser ce test.
