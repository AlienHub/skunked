# Contributing to SKUNKED Open Data

Thanks for helping improve the independent public anti-phishing dataset.

SKUNKED Open Data is published as a standalone dataset and public read-only
service. The browser extension, dataset browser, enterprise cloud API, and future
SaaS management surfaces consume the same public dataset contract.

## Scope

We currently accept:

1. Official software domain updates (`open-data/apps.json`)
2. Confirmed phishing domain submissions (`open-data/phishing-confirmed.json`)

## Submission Flow

1. Open an Issue or PR with evidence.
2. Maintainer performs manual review.
3. Approved records are merged and released with a new dataset manifest.
4. Release notes mention key additions/removals.

## Evidence Requirements

Please include at least one of:

- Security report link
- Trusted vendor takedown record
- Internal SOC verification note
- Repro steps and snapshot hash

Do not include personal data or private credentials.

## False Positive Appeal

If your domain was listed incorrectly:

1. Open an Issue with subject `False Positive Appeal`.
2. Provide domain ownership proof and supporting details.
3. Maintainer responds within SLA target below.

## SLA Target

- New suspicious submission triage: within **3 business days**
- False positive appeal response: within **2 business days**

## Local Checks

Before opening a PR:

```bash
pnpm open-data:validate
pnpm open-data:build
```

Both commands must pass.
