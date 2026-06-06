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
  OPEN_API_ACCESS_LOGS?: R2Bucket
  OPEN_API_RATE_LIMIT_KV?: KVNamespace
  OPEN_API_RATE_LIMIT_PER_MINUTE?: string
}

type OpenApiSecurityContext = {
  requestId: string
  startedAt: number
  ip: string
  fingerprintHash: string
  method: string
  pathname: string
  query: string
  userAgent: string
  acceptLanguage: string
  referer: string
  origin: string
  country: string
  colo: string
  asn: number | null
  cfRay: string
  suspiciousSignals: string[]
}

type OpenApiRateLimitState = {
  allowed: boolean
  limit: number
  remaining: number
  resetAt: number
  current: number
  keyHash: string
  skipped: boolean
}

const appRecords = apps as AppRecord[]
const phishingRecords = phishing as PhishingRecord[]

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, X-Client-Fingerprint",
  "Cache-Control": "public, max-age=300"
}

function json(
  payload: unknown,
  status = 200,
  extraHeaders: HeadersInit = {}
): Response {
  const headers = new Headers({
    ...corsHeaders,
    "Content-Type": "application/json"
  })
  new Headers(extraHeaders).forEach((value, key) => {
    headers.set(key, value)
  })

  return new Response(JSON.stringify(payload), {
    status,
    headers
  })
}

function head(status = 200, extraHeaders: HeadersInit = {}): Response {
  const headers = new Headers(corsHeaders)
  new Headers(extraHeaders).forEach((value, key) => {
    headers.set(key, value)
  })

  return new Response(null, {
    status,
    headers
  })
}

function getOpenApiRateLimit(env: Env): number {
  const configured = Number(env.OPEN_API_RATE_LIMIT_PER_MINUTE || "5")
  if (!Number.isFinite(configured) || configured < 1) return 5
  return Math.floor(configured)
}

function getClientIp(request: Request): string {
  const connectingIp = request.headers.get("cf-connecting-ip")
  if (connectingIp) return connectingIp

  const forwardedFor = request.headers.get("x-forwarded-for")
  if (forwardedFor) return forwardedFor.split(",")[0]?.trim() || "unknown"

  return "unknown"
}

function getCfNumber(value: unknown): number | null {
  if (typeof value !== "number" || !Number.isFinite(value)) return null
  return value
}

function toHex(buffer: ArrayBuffer): string {
  return [...new Uint8Array(buffer)]
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("")
}

async function sha256Hex(value: string): Promise<string> {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(value)
  )
  return toHex(digest)
}

function getSuspiciousSignals(request: Request): string[] {
  const signals: string[] = []
  const userAgent = request.headers.get("user-agent") || ""
  const acceptLanguage = request.headers.get("accept-language") || ""

  if (!userAgent) signals.push("missing_user_agent")
  if (!acceptLanguage) signals.push("missing_accept_language")

  if (
    /\b(curl|wget|python|bot|spider|crawler|scrapy|httpclient|go-http-client|okhttp)\b/i.test(
      userAgent
    )
  ) {
    signals.push("automation_user_agent")
  }

  return signals
}

async function buildOpenApiSecurityContext(
  request: Request,
  url: URL
): Promise<OpenApiSecurityContext> {
  const cf = (request as Request & { cf?: Record<string, unknown> }).cf || {}
  const ip = getClientIp(request)
  const userAgent = request.headers.get("user-agent") || ""
  const accept = request.headers.get("accept") || ""
  const acceptLanguage = request.headers.get("accept-language") || ""
  const acceptEncoding = request.headers.get("accept-encoding") || ""
  const clientFingerprint =
    request.headers.get("x-client-fingerprint")?.trim() || ""
  const rawFingerprint = [
    ip,
    userAgent,
    accept,
    acceptLanguage,
    acceptEncoding,
    request.headers.get("sec-ch-ua") || "",
    request.headers.get("sec-ch-ua-mobile") || "",
    request.headers.get("sec-ch-ua-platform") || "",
    clientFingerprint,
    request.headers.get("cf-ipcountry") || ""
  ].join("\n")

  return {
    requestId: crypto.randomUUID(),
    startedAt: Date.now(),
    ip,
    fingerprintHash: await sha256Hex(rawFingerprint),
    method: request.method,
    pathname: url.pathname,
    query: url.search,
    userAgent,
    acceptLanguage,
    referer: request.headers.get("referer") || "",
    origin: request.headers.get("origin") || "",
    country:
      String(cf.country || request.headers.get("cf-ipcountry") || "") ||
      "unknown",
    colo: String(cf.colo || "") || "unknown",
    asn: getCfNumber(cf.asn),
    cfRay: request.headers.get("cf-ray") || "",
    suspiciousSignals: getSuspiciousSignals(request)
  }
}

async function checkOpenApiRateLimit(
  env: Env,
  context: OpenApiSecurityContext
): Promise<OpenApiRateLimitState> {
  const limit = getOpenApiRateLimit(env)
  const now = Date.now()
  const windowStart = Math.floor(now / 60000) * 60000
  const resetAt = windowStart + 60000
  const key = `open-api-rate:${windowStart}:${context.ip}:${context.fingerprintHash}`
  const keyHash = await sha256Hex(key)

  if (!env.OPEN_API_RATE_LIMIT_KV) {
    return {
      allowed: true,
      limit,
      remaining: limit,
      resetAt,
      current: 0,
      keyHash,
      skipped: true
    }
  }

  const currentRaw = await env.OPEN_API_RATE_LIMIT_KV.get(key)
  const current = Number(currentRaw || "0")
  const next = Number.isFinite(current) ? current + 1 : 1

  await env.OPEN_API_RATE_LIMIT_KV.put(key, String(next), {
    expirationTtl: 120
  })

  return {
    allowed: next <= limit,
    limit,
    remaining: Math.max(0, limit - next),
    resetAt,
    current: next,
    keyHash,
    skipped: false
  }
}

function getOpenApiSecurityHeaders(
  context: OpenApiSecurityContext,
  rateLimit: OpenApiRateLimitState
): HeadersInit {
  const headers: Record<string, string> = {
    "X-Request-Id": context.requestId,
    "X-RateLimit-Limit": String(rateLimit.limit),
    "X-RateLimit-Remaining": String(rateLimit.remaining),
    "X-RateLimit-Reset": String(Math.ceil(rateLimit.resetAt / 1000))
  }

  if (!rateLimit.allowed) {
    headers["Retry-After"] = String(
      Math.max(1, Math.ceil((rateLimit.resetAt - Date.now()) / 1000))
    )
  }

  return headers
}

function withResponseHeaders(
  response: Response,
  extraHeaders: HeadersInit
): Response {
  const headers = new Headers(response.headers)
  new Headers(extraHeaders).forEach((value, key) => {
    headers.set(key, value)
  })

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers
  })
}

async function logOpenApiAccess(
  env: Env,
  context: OpenApiSecurityContext,
  rateLimit: OpenApiRateLimitState,
  status: number,
  durationMs: number
): Promise<void> {
  if (!env.OPEN_API_ACCESS_LOGS) return

  const loggedAt = new Date()
  const yyyy = loggedAt.getUTCFullYear()
  const mm = String(loggedAt.getUTCMonth() + 1).padStart(2, "0")
  const dd = String(loggedAt.getUTCDate()).padStart(2, "0")
  const hh = String(loggedAt.getUTCHours()).padStart(2, "0")
  const objectKey = [
    `open-api-access/year=${yyyy}`,
    `month=${mm}`,
    `day=${dd}`,
    `hour=${hh}`,
    `${context.requestId}.json`
  ].join("/")

  await env.OPEN_API_ACCESS_LOGS.put(
    objectKey,
    JSON.stringify({
      requestId: context.requestId,
      timestamp: loggedAt.toISOString(),
      method: context.method,
      path: context.pathname,
      query: context.query,
      status,
      durationMs,
      client: {
        ip: context.ip,
        fingerprintHash: context.fingerprintHash,
        userAgent: context.userAgent,
        acceptLanguage: context.acceptLanguage,
        referer: context.referer,
        origin: context.origin,
        country: context.country,
        colo: context.colo,
        asn: context.asn,
        cfRay: context.cfRay
      },
      analysis: {
        suspiciousSignals: context.suspiciousSignals,
        blockedByRateLimit: !rateLimit.allowed
      },
      rateLimit: {
        limit: rateLimit.limit,
        current: rateLimit.current,
        remaining: rateLimit.remaining,
        resetAt: rateLimit.resetAt,
        keyHash: rateLimit.keyHash,
        skipped: rateLimit.skipped
      }
    }),
    {
      httpMetadata: {
        contentType: "application/json"
      },
      customMetadata: {
        requestId: context.requestId,
        status: String(status),
        path: context.pathname
      }
    }
  )
}

async function withOpenApiSecurity(
  request: Request,
  env: Env,
  ctx: ExecutionContext,
  url: URL,
  handler: (extraHeaders: HeadersInit) => Response
): Promise<Response> {
  const context = await buildOpenApiSecurityContext(request, url)
  const rateLimit = await checkOpenApiRateLimit(env, context)
  const securityHeaders = getOpenApiSecurityHeaders(context, rateLimit)
  let response: Response

  if (!rateLimit.allowed) {
    context.suspiciousSignals.push("rate_limit_exceeded")
    response = json(
      {
        error: "rate_limited",
        message: "请求过于频繁，请稍后再试。",
        requestId: context.requestId
      },
      429,
      securityHeaders
    )
  } else {
    response = withResponseHeaders(handler(securityHeaders), securityHeaders)
  }

  ctx.waitUntil(
    logOpenApiAccess(
      env,
      context,
      rateLimit,
      response.status,
      Date.now() - context.startedAt
    )
  )

  return response
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
  async fetch(
    request: Request,
    env: Env,
    ctx: ExecutionContext
  ): Promise<Response> {
    if (request.method === "OPTIONS") {
      return new Response(null, { headers: corsHeaders })
    }

    const url = new URL(request.url)
    const isHead = request.method === "HEAD"

    if (
      (request.method === "GET" || isHead) &&
      url.pathname === "/v1/open/manifest"
    ) {
      return withOpenApiSecurity(request, env, ctx, url, () =>
        isHead ? head() : handleManifest()
      )
    }

    if (
      (request.method === "GET" || isHead) &&
      url.pathname === "/v1/open/apps"
    ) {
      return withOpenApiSecurity(request, env, ctx, url, () =>
        isHead ? head() : handleApps()
      )
    }

    if (
      (request.method === "GET" || isHead) &&
      url.pathname === "/v1/open/phishing"
    ) {
      return withOpenApiSecurity(request, env, ctx, url, () =>
        isHead ? head() : handlePhishing(url)
      )
    }

    if (
      (request.method === "GET" || isHead) &&
      url.pathname === "/v1/open/lookup"
    ) {
      return withOpenApiSecurity(request, env, ctx, url, () =>
        isHead ? head() : handleLookup(url)
      )
    }

    return env.ASSETS.fetch(request)
  }
}
