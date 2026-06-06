# AGENTS.md

This file provides guidance to Codex when working with code in this
repository.

## Project Overview

SKUNKED is an enterprise anti-phishing browser extension for Chrome/Edge built
with Plasmo, React, TypeScript, and Manifest V3. The extension combines local
rules, an open dataset, heuristic domain analysis, optional cloud semantic
analysis, enterprise policy sync, and event reporting.

This repository is a pnpm workspace:

| Package             | Path                 | Purpose                                                                   |
| ------------------- | -------------------- | ------------------------------------------------------------------------- |
| `skunked-extension` | `.`                  | Plasmo MV3 browser extension                                              |
| `skunked-cloud-api` | `cloudflare-worker/` | Enterprise Cloudflare Worker API for policy, analysis, events, activation |
| `skunked-open-data` | `open-data/`         | Independent public official app and confirmed phishing domain dataset     |
| `skunked-site`      | `site/`              | Static landing page and dataset browser                                   |

All user-facing extension text is Chinese.

## Development Commands

Use pnpm from the repository root.

```bash
# Install dependencies
pnpm install

# Generate the offline open-data snapshot used by the extension
pnpm gen:snapshot

# Extension development; predev regenerates the offline snapshot
pnpm dev

# Optional local services
pnpm dev:worker
pnpm dev:site
pnpm dev:open-data

# Extension build/package
pnpm build
pnpm package

# Whole-workspace checks
pnpm build:all
pnpm typecheck:all
pnpm lint:all
pnpm test:all
pnpm format:check:all

# Focused checks
pnpm typecheck
pnpm lint
pnpm test
pnpm test:watch
pnpm open-data:validate
pnpm open-data:build
pnpm open-data:ui:build
```

Loading the extension in development:

1. Run `pnpm dev`.
2. Open `chrome://extensions` or `edge://extensions`.
3. Enable Developer mode.
4. Load unpacked extension from `build/chrome-mv3-dev`.

## Current Architecture

The extension is MV3 with a service-worker background script. The core runtime
flow is page-level analysis:

1. `src/background.ts` listens to `chrome.webNavigation.onCompleted` for the
   top frame.
2. `src/services/securityEngine.ts` runs URL-only precheck first:
   - Layer 1: search engine and official-domain allowlist, open-data confirmed
     phishing domains, local blacklist.
   - Layer 2: protected-app scoping, typosquatting, domain similarity,
     sensitive keyword and download-intent heuristics.
3. If the precheck returns `NEEDS_DOM_REVIEW_REASON`, the background asks
   `src/content.ts` for minimal DOM context.
4. Layer 3 cloud analysis runs only when needed. If the tenant is not activated,
   cloud-required scenarios degrade to a local warning.
5. Results are stored in `chrome.storage.local` under `analysis_${tabId}` and
   surfaced in `src/popup.tsx`.
6. `block` injects a full-page overlay; `warn` injects a top warning bar.
7. Decisions and user bypasses are queued in `src/services/reporting.ts` and
   periodically flushed to the cloud API.

Background alarms:

| Alarm                       | Purpose                | Default interval |
| --------------------------- | ---------------------- | ---------------- |
| `skunked-reporting-upload`  | Flush reporting queue  | 2 minutes        |
| `skunked-policy-sync`       | Pull enterprise policy | 30 minutes       |
| `skunked-open-dataset-sync` | Sync open dataset      | 6 hours          |

## Extension Entry Points

- `src/background.ts` - Service worker orchestration: storage bootstrap, alarms,
  page analysis, policy sync, open-data sync, enterprise activation, reporting,
  and runtime info messages.
- `src/content.ts` - Page-context DOM extraction plus risk overlay/warning UI
  injection.
- `src/popup.tsx` - Browser action popup showing current page status, stats,
  tenant status, dataset version, and reporting queue size.
- `src/options.tsx` - Enterprise management page for activation, policy sync,
  dataset sync, and manual reporting flush.

## Important Service Modules

- `src/services/securityEngine.ts` - Three-layer phishing decision engine.
- `src/services/openDataset.ts` - Open-data sync and fallback snapshot loading.
- `src/services/cloudClient.ts` - Cloud API client for activation, policy,
  analysis, and event upload.
- `src/services/reporting.ts` - Event creation, queueing, retry, and upload.
- `src/services/domExtractor.ts` - Minimal DOM signal extraction.
- `src/services/brandMatcher.ts` - Brand matching from URL and page signals.
- `src/utils/cache.ts` - `chrome.storage.local` schema helpers, policy defaults,
  cache, tenant activation, stats, dataset state, and reporting queue.
- `src/utils/domainMatcher.ts` - Domain normalization, similarity, official
  domain, search engine, and typosquatting helpers.
- `src/types/index.ts` and `src/types/messages.ts` - Shared data and message
  contracts.

## Message Passing

Messages handled by `background.ts`:

- `get_page_status`
- `activate_tenant`
- `sync_policy`
- `sync_open_dataset`
- `flush_reporting`
- `get_runtime_info`
- `report_false_positive`
- `risk_bypassed`

Messages handled by `content.ts`:

- `extract_dom`
- `inject_overlay`
- `inject_warning`

For any asynchronous `chrome.runtime.onMessage` handler, return `true` after
starting the async work so `sendResponse` remains valid.

## Cloudflare Worker

`cloudflare-worker/src/index.ts` exposes:

- `GET /v1/health`
- `POST /v1/activate`
- `GET /v1/policy`
- `POST /v1/analyze`
- `POST /v1/events/batch`
- `GET /v1/events/export`

Historical `/v1/open/*` handlers may exist for compatibility, but the Cloud API
is no longer the open-data source of truth. New clients should use the
independent Open Data API base URL.

Bindings and secrets:

- `EVENTS_DB` - Cloudflare D1 database.
- `ACTIVATION_KV` - Cloudflare KV namespace.
- `MODEL_BASE_URL`, `MODEL_NAME`, `MODEL_TIMEOUT_MS`.
- `MODEL_API_KEY` - optional secret. If absent or model calls fail, the Worker
  falls back to deterministic local analysis.
- `INTERNAL_EXPORT_KEY` - required for event export.

Use `cloudflare-worker/wrangler.toml.example` as the safe template. Be careful
with `cloudflare-worker/wrangler.toml` because it may contain environment-specific
IDs.

## Open Dataset

The open-data package contains:

- `open-data/apps.json` - protected official applications and domains.
- `open-data/phishing-confirmed.json` - confirmed phishing domains.
- `open-data/schema/*.schema.json` - dataset schemas.
- `open-data/dataset-manifest.json` - generated manifest.

The open-data package is an independent public dataset. It is consumed by the
extension, the public site, the enterprise cloud API, and future SaaS management
surfaces. It must not depend on the enterprise event/policy D1 database.

Root scripts:

- `pnpm open-data:validate` validates JSON data against schemas.
- `pnpm open-data:build` regenerates the dataset manifest.
- `pnpm dev:open-data` starts the independent Vite dataset page.
- `pnpm open-data:ui:build` builds the independent Vite dataset page.
- `pnpm gen:snapshot` generates the extension's offline snapshot from the
  dataset.

The extension syncs open data from `PLASMO_PUBLIC_OPEN_DATA_API_BASE_URL` when
available and falls back to the generated local snapshot when offline or
uninitialized.

## Configuration

Extension public env vars are read in `src/constants/config.ts`:

- `PLASMO_PUBLIC_CLOUD_API_BASE_URL`
- `PLASMO_PUBLIC_OPEN_DATA_API_BASE_URL`
- `PLASMO_PUBLIC_CLOUD_ANALYZE_TIMEOUT_MS`
- `PLASMO_PUBLIC_CLOUD_POLICY_SYNC_INTERVAL_MINUTES`
- `PLASMO_PUBLIC_OPEN_DATASET_SYNC_INTERVAL_MINUTES`
- `PLASMO_PUBLIC_CLOUD_REPORT_UPLOAD_INTERVAL_MINUTES`
- `PLASMO_PUBLIC_CLOUD_REPORT_BATCH_SIZE`
- `PLASMO_PUBLIC_WARNING_THRESHOLD`
- `PLASMO_PUBLIC_BLOCK_THRESHOLD`
- `PLASMO_PUBLIC_CACHE_EXPIRY_MS`
- `PLASMO_PUBLIC_REPORT_MAX_RETRIES`
- `PLASMO_PUBLIC_LOG_LEVEL`

Manifest permissions are configured in the root `package.json` `manifest`
section. Current host permissions include both `https://*/*` and `http://*/*`;
extension permissions include `webNavigation`, `storage`, `tabs`, and `alarms`.

## File Structure

- `src/` - Extension source.
- `src/data/officialRegistry.ts` - Legacy/local official software registry.
- `assets/` - Extension icons.
- `scripts/` - Dataset manifest, validation, and offline snapshot
  scripts.
- `open-data/` - Independent public dataset package.
- `cloudflare-worker/` - Enterprise Cloud API package.
- `site/` - Static marketing/data browser package.
- `docs/` - Enterprise deployment, privacy policy, and cloud API docs.
- `build/`, `.plasmo/`, `dist/`, `.wrangler/` - Generated output; do not edit
  manually.

## Code Style

- Formatter: Prettier with no semicolons, double quotes, 2-space indentation,
  and 80 character line width.
- TypeScript strict mode is enabled.
- ESLint uses flat config in `eslint.config.mjs`, `typescript-eslint`,
  `eslint-config-prettier`, and `eslint-plugin-simple-import-sort`.
- Import sorting is enforced for `src/**/*.{ts,tsx}` and
  `cloudflare-worker/src/**/*.ts`.
- Vitest is configured in `vitest.config.ts` for logic tests in `src/**/*.test.ts`
  and `cloudflare-worker/src/**/*.test.ts`.

## Testing Guidance

Prefer focused checks for small changes, and run broader workspace checks for
cross-package changes:

- Extension logic: `pnpm test`, `pnpm typecheck`, `pnpm lint`.
- Cloud Worker logic: `pnpm --filter skunked-cloud-api typecheck` and root
  `pnpm test` for Worker tests included by Vitest.
- Open-data changes: `pnpm open-data:validate`, `pnpm open-data:build`, then
  `pnpm gen:snapshot` if extension fallback data should change.
- Workspace-wide changes: `pnpm test:all`, `pnpm typecheck:all`,
  `pnpm lint:all`, and `pnpm format:check:all`.

## Important Notes

- Keep user-facing extension copy in Chinese.
- Minimize DOM data sent for cloud analysis; the project intentionally uploads
  only compact page signals.
- Do not edit generated Plasmo output under `.plasmo/` or build artifacts under
  `build/`.
- Avoid bypassing the local-first detection chain when changing cloud behavior;
  unactivated tenants must still have useful local protection.
- Preserve the unified verdict protocol:
  `verdict: "allow" | "warn" | "block"`, `confidence: 0-100`, and a Chinese
  `reason`.
- When adding or changing message actions, update `src/types/messages.ts` and
  both sender/receiver code paths together.
- When changing storage shape, update the helpers/defaults in `src/utils/cache.ts`
  and keep bootstrap compatibility in `src/background.ts`.
