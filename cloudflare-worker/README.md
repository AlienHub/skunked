# SKUNKED Cloud API (Cloudflare Worker)

This Worker provides enterprise activation, policy, analysis, event ingestion,
and export APIs for the SKUNKED extension.

Open-data is a separate public dataset service. This Worker may retain
`/v1/open/*` compatibility handlers during migration, but new clients should use
the independent SKUNKED Open Data API documented in `../docs/open-data-api.md`.

The compatibility `/v1/open/*` endpoints include public-interface protections:
every request is logged to R2 object storage, requests are rate limited by
client IP plus browser fingerprint, and suspicious client signals are recorded
for abuse analysis.

## Endpoints

- `POST /v1/activate`
- `GET /v1/policy`
- `POST /v1/analyze`
- `POST /v1/events/batch`
- `GET /v1/events/export`

## Local Development

```bash
pnpm install
pnpm dev
```

## Required Bindings

Copy `wrangler.toml.example` to `wrangler.toml` and replace placeholder IDs with your Cloudflare resources:

```bash
cp wrangler.toml.example wrangler.toml
wrangler d1 create skunked-events
wrangler kv namespace create ACTIVATION_KV
wrangler kv namespace create OPEN_API_RATE_LIMIT_KV
wrangler r2 bucket create skunked-open-api-access-logs
```

Update `database_id`, KV `id`, and R2 bucket names in `wrangler.toml`.
**Do not commit real binding IDs** — the repo ships placeholders only.

Configure the following bindings:

- `EVENTS_DB` (D1)
- `ACTIVATION_KV` (KV)
- `OPEN_API_RATE_LIMIT_KV` (KV)
- `OPEN_API_ACCESS_LOGS` (R2)

Configure the public open API security variables:

- `OPEN_API_RATE_LIMIT_PER_MINUTE` - default `5`

Configure Worker secrets (local dev via `.dev.vars`, production via `wrangler secret put`):

```bash
cp .dev.vars.example .dev.vars
# edit .dev.vars with your keys

wrangler secret put MODEL_API_KEY
wrangler secret put INTERNAL_EXPORT_KEY
```

## Database Migration

Apply schema:

```bash
wrangler d1 execute skunked-events --file=./schema.sql
```

Dataset import into the enterprise D1 is a legacy compatibility workflow. The
preferred model is for this Worker and the extension to consume the independent
Open Data API instead of storing public dataset tables in `EVENTS_DB`.

## Open API Security

The public compatibility endpoints under `/v1/open/*` are protected before they
query the dataset:

- All access logs are written to `OPEN_API_ACCESS_LOGS` under
  `open-api-access/year=YYYY/month=MM/day=DD/hour=HH/<requestId>.json`.
- The default limit is 5 requests per minute for each client IP plus request
  fingerprint. Fingerprints are stored as SHA-256 hashes.
- Responses include `X-Request-Id`, `X-RateLimit-Limit`,
  `X-RateLimit-Remaining`, and `X-RateLimit-Reset`.
- When the limit is exceeded, the Worker returns HTTP `429` with `Retry-After`.
- Logs include IP, fingerprint hash, Cloudflare country/colo/ASN when available,
  user agent, referrer/origin, status, duration, and suspicious-signal labels
  such as missing user agent, automation user agent, and rate-limit exceeded.

## Activation Code Provisioning

Activation codes are stored in KV using this pattern:

- Key: `activation:<code>`
- Value example:

```json
{
  "orgId": "org_demo",
  "endpoint": "https://skunked-api.example.workers.dev",
  "policy": {
    "warningThreshold": 60,
    "blockThreshold": 90,
    "mode": "balanced",
    "policyVersion": "org-demo-v1",
    "updatedAt": 1700000000000
  }
}
```
