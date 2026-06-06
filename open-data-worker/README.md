# SKUNKED Open Data API

Independent Cloudflare Worker for public open-data endpoints.

This Worker is separate from the enterprise cloud API. It does not use the
enterprise D1 database, activation KV, tenant tokens, policy sync, semantic
analysis, or event reporting.

It also serves the independent Vite dataset page from `open-data/dist-ui/` and
is bound to `skunked-open-data.pindo.page` as a Worker custom domain.

## Endpoints

- `GET /v1/open/manifest`
- `GET /v1/open/apps`
- `GET /v1/open/phishing`
- `GET /v1/open/lookup?host=<hostname>`

## Local Development

```bash
pnpm install
pnpm --filter skunked-open-data ui:build
pnpm --filter skunked-open-data-api dev
```

## Deploy

```bash
pnpm --filter skunked-open-data ui:build
pnpm --filter skunked-open-data-api deploy
```
