import apps from "../../open-data/apps.json"
import manifest from "../../open-data/dataset-manifest.json"
import phishing from "../../open-data/phishing-confirmed.json"

type AppRecord = {
  id: string
  slug: string
  name: string
  nameEn: string
  category: string
  officialDomains: string[]
  officialUrls: string[]
  keywords: string[]
}

type PhishingRecord = {
  domain: string
  targetAppId?: string
  status: "confirmed"
  source: string
  firstSeenAt: string
  lastSeenAt: string
  reviewedAt: string
  reviewer: string
}

type Env = {
  ASSETS: Fetcher
}

const appRecords = apps as AppRecord[]
const phishingRecords = phishing as PhishingRecord[]

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
  "Cache-Control": "public, max-age=300"
}

function json(payload: unknown, status = 200): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json"
    }
  })
}

function head(status = 200): Response {
  return new Response(null, {
    status,
    headers: corsHeaders
  })
}

function parseIntParam(value: string | null, fallback: number): number {
  if (!value) return fallback
  const parsed = Number.parseInt(value, 10)
  return Number.isFinite(parsed) ? parsed : fallback
}

function normalizeHostInput(value: string | null): string | null {
  if (!value) return null
  const trimmed = value.trim().toLowerCase()
  if (!trimmed) return null

  let host = trimmed
  try {
    host = new URL(trimmed.includes("://") ? trimmed : `https://${trimmed}`)
      .host
  } catch {
    host = trimmed
  }

  host = host.replace(/^www\./, "").split(":")[0]
  return /^(?!www\.)[a-z0-9-]+(\.[a-z0-9-]+)+$/.test(host) ? host : null
}

function isSameOrSubdomain(host: string, domain: string): boolean {
  return host === domain || host.endsWith(`.${domain}`)
}

function handleManifest(): Response {
  return json({
    version: manifest.version,
    generatedAt: manifest.generatedAt,
    counts: manifest.recordCounts,
    sha256: manifest.sha256
  })
}

function handleApps(): Response {
  return json({
    version: manifest.version,
    generatedAt: manifest.generatedAt,
    items: appRecords
  })
}

function handlePhishing(url: URL): Response {
  const status = (url.searchParams.get("status") || "confirmed")
    .trim()
    .toLowerCase()
  const targetAppId =
    url.searchParams.get("targetAppId")?.trim().toLowerCase() || null
  const query = url.searchParams.get("q")?.trim().toLowerCase() || null
  const page = Math.max(1, parseIntParam(url.searchParams.get("page"), 1))
  const pageSize = Math.min(
    100,
    Math.max(1, parseIntParam(url.searchParams.get("pageSize"), 20))
  )

  if (status !== "confirmed") {
    return json({ error: "status must be confirmed" }, 400)
  }

  const filtered = phishingRecords
    .filter((record) => !targetAppId || record.targetAppId === targetAppId)
    .filter((record) => !query || record.domain.includes(query))
    .sort((a, b) => {
      const reviewedDiff =
        Date.parse(b.reviewedAt || "") - Date.parse(a.reviewedAt || "")
      return reviewedDiff || a.domain.localeCompare(b.domain)
    })

  const offset = (page - 1) * pageSize
  const items = filtered.slice(offset, offset + pageSize)

  return json({
    version: manifest.version,
    generatedAt: manifest.generatedAt,
    items,
    pagination: {
      page,
      pageSize,
      total: filtered.length,
      totalPages:
        filtered.length === 0 ? 0 : Math.ceil(filtered.length / pageSize)
    }
  })
}

function handleLookup(url: URL): Response {
  const host = normalizeHostInput(url.searchParams.get("host"))

  if (!host) {
    return json({ error: "host is required and must be a valid domain" }, 400)
  }

  const officialMatch = appRecords
    .flatMap((app) =>
      app.officialDomains.map((domain) => ({
        domain,
        appId: app.id,
        appName: app.name,
        appSlug: app.slug
      }))
    )
    .filter((item) => isSameOrSubdomain(host, item.domain))
    .sort((a, b) => b.domain.length - a.domain.length)[0]

  const phishingMatch = phishingRecords
    .filter((record) => isSameOrSubdomain(host, record.domain))
    .sort((a, b) => b.domain.length - a.domain.length)[0]

  const targetApp = phishingMatch?.targetAppId
    ? appRecords.find((app) => app.id === phishingMatch.targetAppId)
    : undefined

  return json({
    host,
    datasetVersion: manifest.version,
    officialMatch,
    phishingMatch: phishingMatch
      ? {
          domain: phishingMatch.domain,
          targetAppId: phishingMatch.targetAppId,
          targetAppName: targetApp?.name,
          status: phishingMatch.status,
          source: phishingMatch.source,
          reviewedAt: phishingMatch.reviewedAt
        }
      : undefined
  })
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    if (request.method === "OPTIONS") {
      return new Response(null, { headers: corsHeaders })
    }

    const url = new URL(request.url)
    const isHead = request.method === "HEAD"

    if (
      (request.method === "GET" || isHead) &&
      url.pathname === "/v1/open/manifest"
    ) {
      return isHead ? head() : handleManifest()
    }

    if (
      (request.method === "GET" || isHead) &&
      url.pathname === "/v1/open/apps"
    ) {
      return isHead ? head() : handleApps()
    }

    if (
      (request.method === "GET" || isHead) &&
      url.pathname === "/v1/open/phishing"
    ) {
      return isHead ? head() : handlePhishing(url)
    }

    if (
      (request.method === "GET" || isHead) &&
      url.pathname === "/v1/open/lookup"
    ) {
      return isHead ? head() : handleLookup(url)
    }

    return env.ASSETS.fetch(request)
  }
}
