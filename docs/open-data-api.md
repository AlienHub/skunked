# SKUNKED Open Data API

Base URL example: `https://skunked-open-data.example.workers.dev`

SKUNKED Open Data is an independent public dataset service. It is separate from
the enterprise cloud API and does not require tenant activation or bearer tokens.
The extension, static dataset browser, SaaS admin tools, and the enterprise
cloud API can all consume this service.

## `GET /v1/open/manifest`

Returns dataset version metadata.

```json
{
  "version": "20260308.d3904f3d",
  "generatedAt": "2026-03-08T13:51:35.211Z",
  "counts": {
    "apps": 10,
    "officialDomains": 20,
    "phishingConfirmed": 6
  },
  "sha256": "d3904f3d2ecbefe4b77c9608b8ac393c31dcdb7973af8d27e52a30c0f161467b"
}
```

## `GET /v1/open/apps`

Returns the public official application catalog and official domains.

```json
{
  "version": "20260308.d3904f3d",
  "generatedAt": "2026-03-08T13:51:35.211Z",
  "items": [
    {
      "id": "feishu",
      "slug": "feishu",
      "name": "飞书",
      "nameEn": "Feishu",
      "category": "communication",
      "officialDomains": ["feishu.cn", "larksuite.com"],
      "officialUrls": ["https://www.feishu.cn"],
      "keywords": ["飞书", "feishu"]
    }
  ]
}
```

## `GET /v1/open/phishing`

Returns public confirmed phishing domains. The list is host-level only.

Query parameters:

- `status`: currently only `confirmed`.
- `targetAppId`: optional target application filter.
- `q`: optional domain substring search.
- `page`: page number, default `1`.
- `pageSize`: page size, default `20`, maximum `100`.

## `GET /v1/open/lookup`

Looks up a hostname against official domains and confirmed phishing domains.

Example:

`GET /v1/open/lookup?host=desktop-wps-download.xyz`

```json
{
  "host": "desktop-wps-download.xyz",
  "datasetVersion": "20260308.d3904f3d",
  "phishingMatch": {
    "domain": "desktop-wps-download.xyz",
    "targetAppId": "wps",
    "status": "confirmed",
    "source": "manual_review",
    "reviewedAt": "2026-03-05T08:20:00.000Z"
  }
}
```
