# SKUNKED Enterprise Anti-Phishing Extension

SKUNKED is a Chrome extension for enterprise phishing defense. It starts working immediately after installation without requiring end users to configure model keys.

## MVP Highlights

- Accurate detection via local multi-layer checks and cloud semantic analysis.
- Async performance-first flow (non-blocking page analysis).
- Calm UX: hard block for high risk, warning for uncertain risk.
- Enterprise operations: activation code binding, event reporting, and export API.
- Dataset-driven detection: open dataset updates without frequent extension releases.
- Independent open-data service for public official app and confirmed phishing data.

## Detection Pipeline

1. Local whitelist/blacklist checks.
2. Heuristic checks for domain similarity and typosquatting.
3. Cloud semantic decision with unified schema:
   - `verdict`: `allow | warn | block`
   - `confidence`: `0-100`
   - `reason`: short explanation
   - `modelTraceId?`, `matchedBrand?`
4. Open dataset sync from the independent public Open Data API (startup + every
   6 hours) with local fallback snapshot.

## Repository Layout

```txt
src/                # Extension code
open-data/          # Independent public dataset source files
cloudflare-worker/  # Enterprise cloud API implementation
site/               # Landing + dataset browser (static)
docs/               # Deployment/privacy/cloud/open-data API docs
```

## Open Dataset Commands

```bash
pnpm open-data:validate
pnpm open-data:build
```

## Local Development

```bash
pnpm install
pnpm dev
pnpm dev:worker   # optional: cloud API
pnpm dev:site     # optional: static site
pnpm build
pnpm typecheck:all
pnpm test
```

Load unpacked extension from `build/chrome-mv3-dev`.

## Worker Setup (Optional)

```bash
cd cloudflare-worker
pnpm install
pnpm dev
```

Configure Worker secrets and bindings before deployment.

## Docs

- [Enterprise deployment guide](./docs/enterprise-deployment.md)
- [Cloud API reference](./docs/cloud-api.md)
- [Open Data API reference](./docs/open-data-api.md)
- [Privacy policy](./docs/privacy-policy.md)
- [Open dataset contribution guide](./CONTRIBUTING_DATASET.md)

## License

Code is licensed under [Apache License 2.0](./LICENSE). Open dataset is licensed under [CC BY 4.0](./open-data/LICENSE.md).
