# Crosspost — Guidelines

## Project Overview

Crosspost is a web app that automatically publishes listings on marketplaces (Leboncoin, Vinted, Facebook Marketplace). Monorepo with pnpm workspaces.

## Stack

- **apps/api** — NestJS backend, MongoDB (Mongoose), Playwright for browser automation
- **apps/web** — Vue 3 + Vuetify 3 frontend (Vite)
- **packages/shared** — Shared Zod schemas, enums, types (no NestJS dependency)

## Architecture Principles

### Validation
- Zod schemas live in `@crosspost/shared` — single source of truth for types
- DTO classes created in the API via `createZodDto()` from `nestjs-zod`
- `ZodValidationPipe` registered globally via `APP_PIPE` in `AppModule` — never use `@UsePipes` or manual pipe instantiation
- Validation errors use `error.issues` for detailed field-level messages

### Media Storage
- S3 presigned POST for uploads, presigned GET for reads — bucket is NOT public
- Listings store `media: { key, contentType }[]` — the S3 key is the source of truth (contains UUID + extension)
- Never store just an ID without the full key — we need the extension to resolve URLs
- `MediaService.getSignedUrls(keys)` generates presigned GET URLs at query time
- Listing GET endpoints return a computed `mediaUrls` array alongside `media`
- Image deletion happens in the backend during listing update (compare old vs new media arrays) — frontend only removes from UI

### Publish Engine (Browser Automation)

Architecture:
```
publish/
├── browser-agent.ts              # Generic agent — Claude tool use loop
├── platforms/
│   ├── platform-publisher.ts     # Interface: getStartUrl(), getSystemPrompt(), extractResult(page)
│   └── leboncoin.publisher.ts    # Leboncoin implementation
├── publish.service.ts            # Orchestrator (DB, sessions, images, delegates to publisher)
├── publish.controller.ts
└── publish.module.ts
```

Rules:
- **Tool use natif Claude** — the LLM calls tools (fill, click, wait_for, upload_images, get_page_state, done) via the Anthropic tool use API. NEVER parse JSON from LLM text output.
- **BrowserAgent is 100% platform-agnostic** — no hardcoded selectors, no platform-specific logic. The agent only knows how to interact with a web page through tools.
- **One PlatformPublisher per marketplace** — contains ONLY: start URL, system prompt (platform-specific instructions), and result extraction logic. Adding a new platform = new publisher file + register in PUBLISHERS map.
- **The LLM drives everything** — form filling, navigation, dropdown handling, autocomplete, submission. We do NOT patch the prompt for every edge case — if the tools are correct, the LLM figures it out.
- **Human-like behavior** — random delays between actions, character-by-character typing, scroll before interact.
- **No Tab key after fill** — it interferes with autocomplete dropdowns. Blur happens naturally on next click.
- **Publication dedup** — unique compound index on `{ listingId, accountId, platform }`, upsert instead of create.

### Sync (Scraping)
- `SyncService` scrapes listings from connected accounts using Playwright
- Leboncoin: extracts data from `__NEXT_DATA__` JSON, not DOM
- Debug snapshots (screenshot + optional HTML) saved for first item and on extraction gaps

### Accounts & Security
- Browser cookies encrypted with AES-256-GCM (`EncryptionService`)
- Decrypt wrapped in try/catch — marks account as disconnected on failure (handles key rotation)

## Conventions

- Language: French for UI text, English for code/comments
- Use `pnpm -r build` to verify changes across the monorepo
- Prefer `lean().exec()` for Mongoose read queries
- Frontend API client: axios instance in `@/api/client`
- No over-engineering: don't add abstractions for one-time operations, don't design for hypothetical futures
