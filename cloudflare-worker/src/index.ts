import { fallbackAnalyze } from "./fallbackAnalyze"

interface Env {
  EVENTS_DB: D1Database
  ACTIVATION_KV: KVNamespace
  MODEL_BASE_URL: string
  MODEL_API_KEY?: string
  MODEL_NAME: string
  MODEL_TIMEOUT_MS?: string
  INTERNAL_EXPORT_KEY?: string
}

interface EffectivePolicy {
  warningThreshold: number
  blockThreshold: number
  mode: "balanced" | "strict" | "relaxed"
  brandSignalMode?: "url_only" | "page_signals"
  policyVersion: string
  updatedAt: number
}

interface ActivationRecord {
  orgId: string
  endpoint?: string
  policy?: EffectivePolicy
}

interface TokenRecord {
  orgId: string
  endpoint?: string
  policy: EffectivePolicy
}

interface DatasetVersionRow {
  version: string
  generated_at: string
  sha256: string
  apps_count: number
  official_domains_count: number
  phishing_confirmed_count: number
}

interface DatasetAppRow {
  id: string
  slug: string
  name: string
  name_en: string
  category: string
  official_urls_json: string
  keywords_json: string
}

interface DatasetDomainRow {
  domain: string
  app_id: string
}

interface DatasetPhishingRow {
  domain: string
  target_app_id: string | null
  status: string
  source: string | null
  first_seen_at: string | null
  last_seen_at: string | null
  reviewed_at: string | null
  reviewer: string | null
}

const defaultPolicy: EffectivePolicy = {
  warningThreshold: 60,
  blockThreshold: 90,
  mode: "balanced",
  brandSignalMode: "url_only",
  policyVersion: "cloud-default-v1",
  updatedAt: Date.now()
}

function normalizePolicy(policy: EffectivePolicy): EffectivePolicy {
  return {
    ...defaultPolicy,
    ...policy,
    brandSignalMode: policy.brandSignalMode || defaultPolicy.brandSignalMode
  }
}

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
  "Access-Control-Allow-Headers": "content-type,authorization,x-admin-key"
}

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json",
      ...corsHeaders
    }
  })
}

function text(body: string, status = 200, contentType = "text/plain"): Response {
  return new Response(body, {
    status,
    headers: {
      "Content-Type": contentType,
      ...corsHeaders
    }
  })
}

function getBearerToken(request: Request): string | null {
  const auth = request.headers.get("authorization")
  if (!auth) return null
  const [type, token] = auth.split(" ")
  if (type?.toLowerCase() !== "bearer") return null
  return token || null
}

async function getTokenRecord(env: Env, token: string): Promise<TokenRecord | null> {
  return env.ACTIVATION_KV.get(`token:${token}`, "json")
}

async function modelAnalyze(env: Env, payload: any) {
  if (!env.MODEL_API_KEY) {
    return fallbackAnalyze(payload)
  }

  const prompt = [
    "你是企业安全网关，请判断页面风险。",
    "你必须输出 JSON，不要包含其他内容。",
    'JSON 格式：{"verdict":"allow|warn|block","confidence":0-100,"reason":"中文简述","matchedBrand":"可选"}',
    `URL: ${payload.url}`,
    `Host: ${payload.host}`,
    `Title: ${payload.title}`,
    `H1: ${payload.h1Text}`,
    `Buttons: ${(payload.buttonTexts || []).join(" | ")}`,
    `Keywords: ${(payload.downloadKeywords || []).join(" | ")}`,
    `BrandHint: ${payload.brandHint || "unknown"}`
  ].join("\n")

  const timeoutMs = Number(env.MODEL_TIMEOUT_MS || "2500")
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)

  try {
    const response = await fetch(`${env.MODEL_BASE_URL.replace(/\/$/, "")}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${env.MODEL_API_KEY}`
      },
      body: JSON.stringify({
        model: env.MODEL_NAME,
        temperature: 0.1,
        max_tokens: 220,
        messages: [
          {
            role: "system",
            content: "你是钓鱼检测引擎。"
          },
          {
            role: "user",
            content: prompt
          }
        ]
      }),
      signal: controller.signal
    })

    if (!response.ok) {
      return fallbackAnalyze(payload)
    }

    const data = (await response.json()) as any
    const raw = data?.choices?.[0]?.message?.content || "{}"

    let parsed: any
    try {
      parsed = JSON.parse(raw)
    } catch {
      parsed = fallbackAnalyze(payload)
    }

    return {
      verdict: parsed.verdict || "warn",
      confidence: Number(parsed.confidence) || 65,
      reason: parsed.reason || "模型返回不稳定，已降级为告警",
      matchedBrand: parsed.matchedBrand,
      modelTraceId: data?.id
    }
  } catch {
    return fallbackAnalyze(payload)
  } finally {
    clearTimeout(timer)
  }
}

function normalizeHostInput(input: string | null): string | null {
  if (!input) return null
  let value = input.trim().toLowerCase()
  if (!value) return null

  value = value.replace(/^https?:\/\//, "")
  value = value.replace(/^www\./, "")
  value = value.split("/")[0].split("?")[0].split("#")[0]
  value = value.split(":")[0]

  if (!value || !/^[a-z0-9-]+(\.[a-z0-9-]+)+$/.test(value)) {
    return null
  }

  return value
}

function parseIntParam(raw: string | null, defaultValue: number): number {
  const parsed = Number(raw)
  if (!Number.isFinite(parsed)) return defaultValue
  return Math.floor(parsed)
}

async function getActiveDatasetVersion(env: Env): Promise<DatasetVersionRow | null> {
  return env.EVENTS_DB.prepare(
    `SELECT version, generated_at, sha256, apps_count, official_domains_count, phishing_confirmed_count
     FROM dataset_versions
     WHERE is_active = 1
     ORDER BY created_at DESC
     LIMIT 1`
  ).first<DatasetVersionRow>()
}

async function handleOpenManifest(env: Env): Promise<Response> {
  const version = await getActiveDatasetVersion(env)

  if (!version) {
    return json(
      {
        version: "uninitialized",
        generatedAt: null,
        counts: {
          apps: 0,
          officialDomains: 0,
          phishingConfirmed: 0
        },
        sha256: ""
      },
      200
    )
  }

  return json({
    version: version.version,
    generatedAt: version.generated_at,
    counts: {
      apps: Number(version.apps_count || 0),
      officialDomains: Number(version.official_domains_count || 0),
      phishingConfirmed: Number(version.phishing_confirmed_count || 0)
    },
    sha256: version.sha256
  })
}

async function handleOpenApps(env: Env): Promise<Response> {
  const [version, appsRowsResult, domainRowsResult] = await Promise.all([
    getActiveDatasetVersion(env),
    env.EVENTS_DB.prepare(
      `SELECT id, slug, name, name_en, category, official_urls_json, keywords_json
       FROM dataset_apps
       ORDER BY name COLLATE NOCASE ASC`
    ).all<DatasetAppRow>(),
    env.EVENTS_DB.prepare(
      `SELECT domain, app_id
       FROM dataset_official_domains`
    ).all<DatasetDomainRow>()
  ])

  const domainMap = new Map<string, string[]>()

  for (const row of domainRowsResult.results || []) {
    const list = domainMap.get(row.app_id) || []
    list.push(row.domain)
    domainMap.set(row.app_id, list)
  }

  const items = (appsRowsResult.results || []).map((app) => {
    let officialUrls: string[] = []
    let keywords: string[] = []

    try {
      officialUrls = JSON.parse(app.official_urls_json)
    } catch {
      officialUrls = []
    }

    try {
      keywords = JSON.parse(app.keywords_json)
    } catch {
      keywords = []
    }

    return {
      id: app.id,
      slug: app.slug,
      name: app.name,
      nameEn: app.name_en,
      category: app.category,
      officialDomains: (domainMap.get(app.id) || []).sort(),
      officialUrls,
      keywords
    }
  })

  return json({
    version: version?.version || "uninitialized",
    generatedAt: version?.generated_at || null,
    items
  })
}

async function handleOpenPhishing(env: Env, requestUrl: URL): Promise<Response> {
  const status = (requestUrl.searchParams.get("status") || "confirmed").trim().toLowerCase()
  const targetAppId = requestUrl.searchParams.get("targetAppId")?.trim().toLowerCase() || null
  const query = requestUrl.searchParams.get("q")?.trim().toLowerCase() || null
  const page = Math.max(1, parseIntParam(requestUrl.searchParams.get("page"), 1))
  const pageSize = Math.min(100, Math.max(1, parseIntParam(requestUrl.searchParams.get("pageSize"), 20)))

  if (status && status !== "confirmed") {
    return json({ error: "status must be confirmed" }, 400)
  }

  const clauses: string[] = []
  const params: Array<string | number> = []

  if (status) {
    clauses.push("status = ?")
    params.push(status)
  }
  if (targetAppId) {
    clauses.push("target_app_id = ?")
    params.push(targetAppId)
  }
  if (query) {
    clauses.push("domain LIKE ?")
    params.push(`%${query}%`)
  }

  const whereSql = clauses.length ? `WHERE ${clauses.join(" AND ")}` : ""
  const offset = (page - 1) * pageSize

  const [version, totalRow, listResult] = await Promise.all([
    getActiveDatasetVersion(env),
    env.EVENTS_DB.prepare(`SELECT COUNT(*) as total FROM dataset_phishing_domains ${whereSql}`)
      .bind(...params)
      .first<{ total: number }>(),
    env.EVENTS_DB.prepare(
      `SELECT domain, target_app_id, status, source, first_seen_at, last_seen_at, reviewed_at, reviewer
       FROM dataset_phishing_domains
       ${whereSql}
       ORDER BY reviewed_at DESC, domain ASC
       LIMIT ? OFFSET ?`
    )
      .bind(...params, pageSize, offset)
      .all<DatasetPhishingRow>()
  ])

  const total = Number(totalRow?.total || 0)
  const items = (listResult.results || []).map((row) => ({
    domain: row.domain,
    targetAppId: row.target_app_id || undefined,
    status: row.status,
    source: row.source || undefined,
    firstSeenAt: row.first_seen_at || undefined,
    lastSeenAt: row.last_seen_at || undefined,
    reviewedAt: row.reviewed_at || undefined,
    reviewer: row.reviewer || undefined
  }))

  return json({
    version: version?.version || "uninitialized",
    generatedAt: version?.generated_at || null,
    items,
    pagination: {
      page,
      pageSize,
      total,
      totalPages: total === 0 ? 0 : Math.ceil(total / pageSize)
    }
  })
}

async function handleOpenLookup(env: Env, requestUrl: URL): Promise<Response> {
  const normalizedHost = normalizeHostInput(requestUrl.searchParams.get("host"))

  if (!normalizedHost) {
    return json({ error: "host is required and must be a valid domain" }, 400)
  }

  const [version, officialMatchRow, phishingMatchRow] = await Promise.all([
    getActiveDatasetVersion(env),
    env.EVENTS_DB.prepare(
      `SELECT d.domain, d.app_id, a.name, a.slug
       FROM dataset_official_domains d
       LEFT JOIN dataset_apps a ON a.id = d.app_id
       WHERE ?1 = d.domain OR ?1 LIKE '%.' || d.domain
       ORDER BY LENGTH(d.domain) DESC
       LIMIT 1`
    )
      .bind(normalizedHost)
      .first<{ domain: string; app_id: string; name: string; slug: string }>(),
    env.EVENTS_DB.prepare(
      `SELECT p.domain, p.target_app_id, p.status, p.source, p.reviewed_at, a.name AS target_app_name
       FROM dataset_phishing_domains p
       LEFT JOIN dataset_apps a ON a.id = p.target_app_id
       WHERE p.status = 'confirmed' AND (?1 = p.domain OR ?1 LIKE '%.' || p.domain)
       ORDER BY LENGTH(p.domain) DESC
       LIMIT 1`
    )
      .bind(normalizedHost)
      .first<{
        domain: string
        target_app_id: string | null
        status: string
        source: string | null
        reviewed_at: string | null
        target_app_name: string | null
      }>()
  ])

  return json({
    host: normalizedHost,
    datasetVersion: version?.version || "uninitialized",
    officialMatch: officialMatchRow
      ? {
          domain: officialMatchRow.domain,
          appId: officialMatchRow.app_id,
          appName: officialMatchRow.name,
          appSlug: officialMatchRow.slug
        }
      : undefined,
    phishingMatch: phishingMatchRow
      ? {
          domain: phishingMatchRow.domain,
          targetAppId: phishingMatchRow.target_app_id || undefined,
          targetAppName: phishingMatchRow.target_app_name || undefined,
          status: phishingMatchRow.status,
          source: phishingMatchRow.source || undefined,
          reviewedAt: phishingMatchRow.reviewed_at || undefined
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

    if (request.method === "GET" && url.pathname === "/v1/health") {
      return json({
        ok: true,
        service: "skunked-cloud-api",
        now: Date.now()
      })
    }

    if (request.method === "GET" && url.pathname === "/v1/open/manifest") {
      try {
        return await handleOpenManifest(env)
      } catch (error) {
        return json({ error: `dataset query failed: ${String(error)}` }, 500)
      }
    }

    if (request.method === "GET" && url.pathname === "/v1/open/apps") {
      try {
        return await handleOpenApps(env)
      } catch (error) {
        return json({ error: `dataset query failed: ${String(error)}` }, 500)
      }
    }

    if (request.method === "GET" && url.pathname === "/v1/open/phishing") {
      try {
        return await handleOpenPhishing(env, url)
      } catch (error) {
        return json({ error: `dataset query failed: ${String(error)}` }, 500)
      }
    }

    if (request.method === "GET" && url.pathname === "/v1/open/lookup") {
      try {
        return await handleOpenLookup(env, url)
      } catch (error) {
        return json({ error: `dataset query failed: ${String(error)}` }, 500)
      }
    }

    if (request.method === "POST" && url.pathname === "/v1/activate") {
      const body = (await request.json()) as { activationCode?: string }
      const activationCode = body.activationCode?.trim()
      if (!activationCode) {
        return json({ error: "activationCode is required" }, 400)
      }

      const activation = (await env.ACTIVATION_KV.get(
        `activation:${activationCode}`,
        "json"
      )) as ActivationRecord | null
      if (!activation) {
        return json({ error: "invalid activation code" }, 401)
      }

      const token = crypto.randomUUID()
      const policy = normalizePolicy(activation.policy || defaultPolicy)
      const tokenRecord: TokenRecord = {
        orgId: activation.orgId,
        endpoint: activation.endpoint,
        policy
      }

      await env.ACTIVATION_KV.put(`token:${token}`, JSON.stringify(tokenRecord), {
        expirationTtl: 60 * 60 * 24 * 7
      })

      return json({
        activation: {
          activated: true,
          orgId: activation.orgId,
          token,
          endpoint: activation.endpoint,
          activatedAt: Date.now(),
          tokenExpiresAt: Date.now() + 1000 * 60 * 60 * 24 * 7
        },
        policy
      })
    }

    if (request.method === "GET" && url.pathname === "/v1/policy") {
      const token = getBearerToken(request)
      if (!token) return json({ error: "unauthorized" }, 401)
      const tokenRecord = await getTokenRecord(env, token)
      if (!tokenRecord) return json({ error: "invalid token" }, 401)

      return json({
        policy: normalizePolicy(tokenRecord.policy || defaultPolicy)
      })
    }

    if (request.method === "POST" && url.pathname === "/v1/analyze") {
      const body = await request.json()
      const result = await modelAnalyze(env, body)
      return json(result)
    }

    if (request.method === "POST" && url.pathname === "/v1/events/batch") {
      const token = getBearerToken(request)
      const tokenRecord = token ? await getTokenRecord(env, token) : null
      const body = (await request.json()) as { events?: any[] }
      const events = body.events || []

      if (!Array.isArray(events) || !events.length) {
        return json({ accepted: 0 })
      }

      try {
        const stmt = env.EVENTS_DB.prepare(`
          INSERT OR REPLACE INTO security_events
          (id, org_id, installation_id, event_type, risk_verdict, confidence, layer, action_taken, url_host, reason, matched_brand, title_digest, h1_digest, dataset_version, ts)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `)

        const queries = events.map((event) =>
          stmt.bind(
            event.id || crypto.randomUUID(),
            event.orgId || tokenRecord?.orgId || null,
            event.installationId || "unknown",
            event.eventType || "warned",
            event.riskVerdict || "warn",
            Number(event.confidence || 0),
            event.layer || "heuristics",
            event.actionTaken || "shown_warning",
            event.urlHost || "unknown",
            event.reason || "",
            event.matchedBrand || null,
            event.titleDigest || null,
            event.h1Digest || null,
            event.datasetVersion || null,
            Number(event.ts || Date.now())
          )
        )

        await env.EVENTS_DB.batch(queries)
      } catch (error) {
        const message = String(error)
        if (!message.includes("dataset_version")) {
          throw error
        }

        // Backward-compatible write path for databases that haven't applied the latest schema.
        const legacyStmt = env.EVENTS_DB.prepare(`
          INSERT OR REPLACE INTO security_events
          (id, org_id, installation_id, event_type, risk_verdict, confidence, layer, action_taken, url_host, reason, matched_brand, title_digest, h1_digest, ts)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `)

        const legacyQueries = events.map((event) =>
          legacyStmt.bind(
            event.id || crypto.randomUUID(),
            event.orgId || tokenRecord?.orgId || null,
            event.installationId || "unknown",
            event.eventType || "warned",
            event.riskVerdict || "warn",
            Number(event.confidence || 0),
            event.layer || "heuristics",
            event.actionTaken || "shown_warning",
            event.urlHost || "unknown",
            event.reason || "",
            event.matchedBrand || null,
            event.titleDigest || null,
            event.h1Digest || null,
            Number(event.ts || Date.now())
          )
        )

        await env.EVENTS_DB.batch(legacyQueries)
      }
      return json({ accepted: events.length })
    }

    if (request.method === "GET" && url.pathname === "/v1/events/export") {
      const adminKey = request.headers.get("x-admin-key")
      if (!env.INTERNAL_EXPORT_KEY || adminKey !== env.INTERNAL_EXPORT_KEY) {
        return json({ error: "forbidden" }, 403)
      }

      const orgId = url.searchParams.get("orgId")
      const from = Number(url.searchParams.get("from") || Date.now() - 86400000)
      const to = Number(url.searchParams.get("to") || Date.now())
      const format = url.searchParams.get("format") || "json"

      const rows = await env.EVENTS_DB.prepare(
        `SELECT * FROM security_events WHERE (?1 IS NULL OR org_id = ?1) AND ts >= ?2 AND ts <= ?3 ORDER BY ts DESC LIMIT 5000`
      )
        .bind(orgId, from, to)
        .all()

      if (format === "csv") {
        const header =
          "id,org_id,event_type,risk_verdict,confidence,layer,action_taken,url_host,reason,dataset_version,ts\n"
        const body = (rows.results || [])
          .map((row: any) =>
            [
              row.id,
              row.org_id || "",
              row.event_type,
              row.risk_verdict,
              row.confidence,
              row.layer,
              row.action_taken,
              row.url_host,
              `"${String(row.reason || "").replace(/"/g, '""')}"`,
              row.dataset_version || "",
              row.ts
            ].join(",")
          )
          .join("\n")
        return text(header + body, 200, "text/csv; charset=utf-8")
      }

      return json({
        total: rows.results?.length || 0,
        items: rows.results || []
      })
    }

    return json({ error: "not found" }, 404)
  }
}
