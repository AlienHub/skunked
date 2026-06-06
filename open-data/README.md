# SKUNKED Open Data Dataset (V1)

This directory is the source of truth for the independent SKUNKED open-data
dataset. The dataset is designed as public security data infrastructure that can
be consumed by the browser extension, the public dataset browser, future SaaS
admin surfaces, and compatible third-party tools.

The open-data dataset is intentionally separate from the enterprise cloud API
and its tenant/event D1 database. Enterprise systems consume this dataset; they
do not own it.

## Public Service Contract

The published open-data service exposes the dataset through unauthenticated
read-only endpoints:

- `GET /v1/open/manifest`
- `GET /v1/open/apps`
- `GET /v1/open/phishing`
- `GET /v1/open/lookup?host=<hostname>`

## Files

- `apps.json`: official software catalog and official download domains.
- `phishing-confirmed.json`: human-reviewed phishing domains (host-level only).
- `dataset-manifest.json`: generated release metadata (version, counts, checksum).
- `schema/*.json`: public data contracts for contributors.
- `ui/`: independent Vite dataset page for browsing the public data.

## Rules

- Domains must be lowercase hostnames.
- Strip protocol, path, and `www.`.
- Duplicate domains are not allowed.
- Only `status = confirmed` can be published.

## Validate and Build

Run from project root:

```bash
pnpm open-data:validate
pnpm open-data:build
```

## Dataset Page

The dataset page is intentionally independent from `site/`. It is built with
Vite and embeds the local JSON dataset, so it can preview the current dataset
without requiring a deployed API.

Run from the project root:

```bash
pnpm dev:open-data
pnpm open-data:ui:build
```

The Vite app lives in `open-data/ui/` and builds to `open-data/dist-ui/`.

## License

Dataset content is licensed under **CC BY 4.0**.
See `open-data/LICENSE.md`.
