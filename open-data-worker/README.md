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

These paths are handled by the Worker before the static asset fallback, so they
return JSON instead of the Vite app shell.

## Local Development

```bash
pnpm install
pnpm --filter skunked-open-data ui:build
pnpm --filter skunked-open-data-api dev
```

## Open API Security

The public `/v1/open/*` endpoints support optional security bindings:

- `OPEN_API_RATE_LIMIT_PER_MINUTE` - default `5`.
- `OPEN_API_RATE_LIMIT_KV` - KV namespace for per-minute rate counters.
- `OPEN_API_ACCESS_LOGS` - R2 bucket for JSON access logs.

When the KV binding is present, requests are limited by client IP plus request
fingerprint. When the R2 binding is present, each request is logged under
`open-api-access/year=YYYY/month=MM/day=DD/hour=HH/<requestId>.json`.

Create the resources before enabling the bindings in `wrangler.toml`:

```bash
wrangler kv namespace create OPEN_API_RATE_LIMIT_KV
wrangler r2 bucket create skunked-open-api-access-logs
```

Responses include `X-Request-Id`, `X-RateLimit-Limit`,
`X-RateLimit-Remaining`, and `X-RateLimit-Reset`. Exceeded requests return
HTTP `429` with `Retry-After`.

## Deploy

```bash
pnpm --filter skunked-open-data ui:build
pnpm --filter skunked-open-data-api deploy
```
