import { defineConfig } from "vite"
import apps from "./apps.json"
import manifest from "./dataset-manifest.json"
import phishing from "./phishing-confirmed.json"

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

const appRecords = apps as AppRecord[]
const phishingRecords = phishing as PhishingRecord[]

const jsonHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
  "Content-Type": "application/json; charset=utf-8"
}

function sendJson(
  res: { writeHead: Function; end: Function },
  payload: unknown
) {
  res.writeHead(200, jsonHeaders)
  res.end(JSON.stringify(payload))
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

function createOpenDataDevApi() {
  return {
    name: "skunked-open-data-dev-api",
    configureServer(server: any) {
      server.middlewares.use((req: any, res: any, next: Function) => {
        if (!req.url || !req.method) {
          next()
          return
        }

        const url = new URL(req.url, "http://127.0.0.1")
        const isHead = req.method === "HEAD"

        if (!url.pathname.startsWith("/v1/open/")) {
          next()
          return
        }

        if (req.method === "OPTIONS") {
          res.writeHead(204, jsonHeaders)
          res.end()
          return
        }

        if (req.method !== "GET" && !isHead) {
          res.writeHead(405, jsonHeaders)
          res.end(JSON.stringify({ error: "method not allowed" }))
          return
        }

        if (isHead) {
          res.writeHead(200, jsonHeaders)
          res.end()
          return
        }

        if (url.pathname === "/v1/open/manifest") {
          sendJson(res, {
            version: manifest.version,
            generatedAt: manifest.generatedAt,
            counts: manifest.recordCounts,
            sha256: manifest.sha256
          })
          return
        }

        if (url.pathname === "/v1/open/apps") {
          sendJson(res, {
            version: manifest.version,
            generatedAt: manifest.generatedAt,
            items: appRecords
          })
          return
        }

        if (url.pathname === "/v1/open/phishing") {
          const status = (url.searchParams.get("status") || "confirmed")
            .trim()
            .toLowerCase()
          const targetAppId =
            url.searchParams.get("targetAppId")?.trim().toLowerCase() || null
          const query = url.searchParams.get("q")?.trim().toLowerCase() || null
          const page = Math.max(
            1,
            parseIntParam(url.searchParams.get("page"), 1)
          )
          const pageSize = Math.min(
            100,
            Math.max(1, parseIntParam(url.searchParams.get("pageSize"), 20))
          )

          if (status !== "confirmed") {
            res.writeHead(400, jsonHeaders)
            res.end(JSON.stringify({ error: "status must be confirmed" }))
            return
          }

          const filtered = phishingRecords
            .filter(
              (record) => !targetAppId || record.targetAppId === targetAppId
            )
            .filter((record) => !query || record.domain.includes(query))
            .sort((a, b) => {
              const reviewedDiff =
                Date.parse(b.reviewedAt || "") - Date.parse(a.reviewedAt || "")
              return reviewedDiff || a.domain.localeCompare(b.domain)
            })
          const offset = (page - 1) * pageSize

          sendJson(res, {
            version: manifest.version,
            generatedAt: manifest.generatedAt,
            items: filtered.slice(offset, offset + pageSize),
            pagination: {
              page,
              pageSize,
              total: filtered.length,
              totalPages:
                filtered.length === 0
                  ? 0
                  : Math.ceil(filtered.length / pageSize)
            }
          })
          return
        }

        if (url.pathname === "/v1/open/lookup") {
          const host = normalizeHostInput(url.searchParams.get("host"))

          if (!host) {
            res.writeHead(400, jsonHeaders)
            res.end(
              JSON.stringify({
                error: "host is required and must be a valid domain"
              })
            )
            return
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

          sendJson(res, {
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
          return
        }

        res.writeHead(404, jsonHeaders)
        res.end(JSON.stringify({ error: "not found" }))
      })
    }
  }
}

export default defineConfig({
  root: "ui",
  publicDir: false,
  plugins: [createOpenDataDevApi()],
  server: {
    host: "127.0.0.1",
    port: 4174
  },
  preview: {
    host: "127.0.0.1",
    port: 4175
  },
  build: {
    outDir: "../dist-ui",
    emptyOutDir: true,
    target: "es2022"
  }
})
