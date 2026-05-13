# Crosspost - Plan du projet

Application web de publication automatisee d'annonces sur Leboncoin et Vinted.

## Architecture

Monorepo pnpm :
- `apps/api` — NestJS + Mongoose + Playwright
- `apps/web` — Vue 3 + Vite + Vuetify 3
- `packages/shared` — DTOs Zod + enums partages

Base de donnees : MongoDB
Validation : Zod (pas class-validator)

## Les 5 couches

### Couche 1 — Formulaire unifie et stockage

Schema "annonce universelle" : titre, description, prix, photos, categorie, etat, marque, taille, couleur.
Stockage en base avec statut par plateforme (brouillon, publie, echec, ID externe).

Un `Listing` (universel) peut avoir plusieurs `Publication` (une par plateforme/compte).

Modele de donnees :
```
User (email, password)
  |
  +-- Account (userId, platform, cookies chiffres, userAgent)
  |     |
  |     +-- Publication (accountId, listingId, externalId, status)
  |
  +-- Listing (userId, title, description, price, category, condition, brand...)
```

### Couche 2 — Mapping IA par plateforme

Pour chaque plateforme, un LLM transforme l'annonce universelle vers le format attendu :
- Vinted : categorie = arbre profond (Femme > Vetements > Robes > Mini) — l'IA recoit l'arbre scrape periodiquement et choisit la bonne feuille
- Leboncoin : idem avec leur taxonomie
- Reformulation du titre pour respecter les longueurs max
- Adaptation de la description au ton de chaque plateforme
- Suggestion de tags Vinted

Cette couche est cacheable (meme annonce = meme mapping).

### Couche 3 — Automatisation navigateur

Stack : Playwright + playwright-extra + plugin stealth (ou Camoufox pour Leboncoin).

Points cles :
- Profil navigateur persistant par compte (cookies, localStorage, fingerprint stable)
- Connexion manuelle initiale, puis reutilisation de la session
- Proxy residentiel si multi-comptes (pas necessaire en usage perso)
- Timings humains : delais aleatoires, mouvements de souris courbes (ghost-cursor), scroll progressif
- Queue de jobs (BullMQ + Redis) pour etaler les publications dans le temps

### Couche 4 — Resilience aux changements de DOM (IA)

C'est le point le plus original du projet. Au lieu de coder en dur `await page.click('#submit-btn')` :

1. **Selecteurs semantiques** : role ARIA, texte visible, labels — resistant aux changements de classes CSS
2. **Fallback IA** : si le selecteur principal echoue, envoyer le HTML/screenshot a un LLM avec "trouve le bouton de soumission" — il renvoie un nouveau selecteur qu'on met en cache
3. **Stagehand** (de Browserbase) : `page.act("clique sur publier")` avec un LLM derriere, cache les actions reussies
4. **Tests d'integrite quotidiens** : un cron qui verifie que les selecteurs critiques repondent, alerte sinon

### Couche 5 — Gestion des captchas

Si DataDome declenche un captcha :
- Option A : 2Captcha / CapSolver (services payants, ~2-3$/1000 captchas)
- Option B : Pause + notification pour resolution manuelle

Commencer par l'option B.

## Plan d'implementation

### Phase 1 — Usage local (en cours)

- [x] Setup monorepo (api + web + shared)
- [x] Schemas Mongoose (User, Account, Listing, Publication)
- [x] Connexion manuelle Leboncoin via Playwright headful
- [x] Stockage cookies chiffres (AES-256-GCM)
- [x] Sync des annonces existantes (scraping mes-annonces + detail)
- [ ] Corriger/affiner le scraping (selecteurs label-based)
- [ ] Publication automatique d'une annonce sur Leboncoin
- [ ] Publication automatique sur Vinted
- [ ] Mapping IA : annonce universelle -> format Leboncoin
- [ ] Mapping IA : annonce universelle -> format Vinted
- [ ] Queue BullMQ pour etaler les publications
- [ ] Upload et gestion des photos (MediaModule)

### Phase 2 — Deploiement serveur

- [ ] Docker Compose (API + MongoDB + Redis)
- [ ] noVNC pour login distant (Xvfb + x11vnc + websockify)
- [ ] Cron de refresh automatique des sessions (cookies)
- [ ] Notification si session expiree (email / push)
- [ ] Auth JWT (login/register avec le schema User)

### Phase 3 — Resilience IA

- [ ] Fallback IA sur les selecteurs (screenshot -> LLM -> nouveau selecteur)
- [ ] Cache des selecteurs IA valides
- [ ] Tests d'integrite quotidiens des selecteurs
- [ ] Integration Stagehand ou equivalent
- [ ] Gestion captchas (2Captcha en fallback)

### Phase 4 — SaaS (plus tard)

- [ ] Multi-tenant
- [ ] Multi-comptes par plateforme
- [ ] Dashboard analytics (vues, messages, ventes)
- [ ] Billing / abonnements
- [ ] Ajout d'autres plateformes (eBay, Etsy, Facebook Marketplace)

## Stack technique

| Composant | Technologie |
|-----------|-------------|
| Backend | NestJS + TypeScript |
| Frontend | Vue 3 + Vite + Vuetify 3 |
| Base de donnees | MongoDB + Mongoose |
| Validation | Zod |
| Automatisation | Playwright + stealth |
| Queue | BullMQ + Redis |
| Chiffrement | AES-256-GCM (cookies) |
| IA | Claude / GPT-4 (mapping + fallback selecteurs) |
| Infra | Docker Compose |
| Login distant | noVNC (Xvfb + x11vnc + websockify) |
