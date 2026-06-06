import apps from "../../apps.json"
import manifest from "../../dataset-manifest.json"
import phishing from "../../phishing-confirmed.json"
import "./styles.css"

type Category = "office" | "communication" | "remote_control" | "security"

type AppRecord = {
  id: string
  slug: string
  name: string
  nameEn: string
  category: Category
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
const apiBase =
  import.meta.env.VITE_OPEN_DATA_API_BASE_URL ||
  "https://skunked-open-data.pindo.page"

const categoryLabels: Record<Category, string> = {
  office: "Office",
  communication: "Comms",
  remote_control: "Remote",
  security: "Security"
}

const state = {
  tab: "apps" as "apps" | "phishing" | "api",
  query: "",
  category: "all" as Category | "all"
}

function escapeHtml(value: unknown): string {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;")
}

function formatDate(value: string): string {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return "--"
  return new Intl.DateTimeFormat("zh-CN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).format(date)
}

function matchesQuery(app: AppRecord, query: string): boolean {
  if (!query) return true
  const haystack = [
    app.id,
    app.slug,
    app.name,
    app.nameEn,
    ...app.officialDomains,
    ...app.keywords
  ]
    .join(" ")
    .toLowerCase()
  return haystack.includes(query.toLowerCase())
}

function matchesPhishingQuery(record: PhishingRecord, query: string): boolean {
  if (!query) return true
  return [record.domain, record.targetAppId, record.source, record.reviewer]
    .filter(Boolean)
    .join(" ")
    .toLowerCase()
    .includes(query.toLowerCase())
}

function getFilteredApps(): AppRecord[] {
  return appRecords.filter(
    (app) =>
      (state.category === "all" || app.category === state.category) &&
      matchesQuery(app, state.query)
  )
}

function getFilteredPhishing(): PhishingRecord[] {
  return phishingRecords.filter((record) =>
    matchesPhishingQuery(record, state.query)
  )
}

function renderMetric(label: string, value: string | number, note: string) {
  return `<div class="metric">
    <span>${escapeHtml(label)}</span>
    <strong>${escapeHtml(value)}</strong>
    <small>${escapeHtml(note)}</small>
  </div>`
}

function renderCategoryRail() {
  const counts = appRecords.reduce<Record<string, number>>((acc, app) => {
    acc[app.category] = (acc[app.category] || 0) + 1
    return acc
  }, {})

  const items: Array<Category | "all"> = [
    "all",
    "office",
    "communication",
    "remote_control",
    "security"
  ]

  return `<div class="rail" role="tablist" aria-label="应用分类">
    ${items
      .map((item) => {
        const label = item === "all" ? "All" : categoryLabels[item]
        const count = item === "all" ? appRecords.length : counts[item] || 0
        return `<button class="rail-item ${state.category === item ? "active" : ""}" data-category="${item}">
          <span>${escapeHtml(label)}</span>
          <strong>${count}</strong>
        </button>`
      })
      .join("")}
  </div>`
}

function renderApps() {
  const filtered = getFilteredApps()
  return `<section class="panel" aria-labelledby="apps-title">
    <div class="panel-head">
      <div>
        <p class="eyebrow">official application registry</p>
        <h2 id="apps-title">官方应用目录</h2>
      </div>
      <span class="count">${filtered.length} / ${appRecords.length}</span>
    </div>
    ${renderCategoryRail()}
    <div class="data-grid">
      ${filtered
        .map(
          (app) => `<article class="app-row">
            <div class="app-main">
              <span class="app-initial">${escapeHtml(app.nameEn.slice(0, 1))}</span>
              <div>
                <h3>${escapeHtml(app.name)}</h3>
                <p>${escapeHtml(app.nameEn)} · ${escapeHtml(app.id)}</p>
              </div>
            </div>
            <div class="domain-stack">
              ${app.officialDomains
                .map((domain) => `<code>${escapeHtml(domain)}</code>`)
                .join("")}
            </div>
            <div class="keyword-line">
              ${app.keywords
                .slice(0, 5)
                .map((keyword) => `<span>${escapeHtml(keyword)}</span>`)
                .join("")}
            </div>
          </article>`
        )
        .join("")}
    </div>
  </section>`
}

function renderPhishing() {
  const filtered = getFilteredPhishing()
  const appMap = new Map(appRecords.map((app) => [app.id, app.name]))

  return `<section class="panel" aria-labelledby="phishing-title">
    <div class="panel-head">
      <div>
        <p class="eyebrow">human reviewed threat domains</p>
        <h2 id="phishing-title">确认钓鱼域名</h2>
      </div>
      <span class="count">${filtered.length} / ${phishingRecords.length}</span>
    </div>
    <div class="table-wrap">
      <table>
        <thead>
          <tr>
            <th>Domain</th>
            <th>Target</th>
            <th>Source</th>
            <th>Reviewed</th>
          </tr>
        </thead>
        <tbody>
          ${filtered
            .map((record) => {
              const target = record.targetAppId
                ? appMap.get(record.targetAppId) || record.targetAppId
                : "--"
              return `<tr>
                <td><code>${escapeHtml(record.domain)}</code></td>
                <td>${escapeHtml(target)}</td>
                <td>${escapeHtml(record.source)}</td>
                <td>${escapeHtml(formatDate(record.reviewedAt))}</td>
              </tr>`
            })
            .join("")}
        </tbody>
      </table>
    </div>
  </section>`
}

function renderApi() {
  const endpoints = [
    ["GET", "/v1/open/manifest", "版本、计数与 sha256"],
    ["GET", "/v1/open/apps", "官方应用目录"],
    ["GET", "/v1/open/phishing", "确认钓鱼域名分页"],
    ["GET", "/v1/open/lookup?host=", "主机名命中查询"]
  ]

  return `<section class="panel api-panel" aria-labelledby="api-title">
    <div class="panel-head">
      <div>
        <p class="eyebrow">public read-only contract</p>
        <h2 id="api-title">Open Data API</h2>
      </div>
      <span class="count">no token</span>
    </div>
    <div class="endpoint-list">
      ${endpoints
        .map(
          ([method, path, desc]) => `<div class="endpoint">
            <span>${method}</span>
            <code>${escapeHtml(path)}</code>
            <p>${escapeHtml(desc)}</p>
          </div>`
        )
        .join("")}
    </div>
    <div class="code-slab">
      <span>Base URL</span>
      <code>${escapeHtml(apiBase)}</code>
    </div>
  </section>`
}

function renderManifestPreview() {
  return `<div class="manifest-preview" aria-label="数据集版本摘要">
    <div class="manifest-head">
      <span>dataset manifest</span>
      <strong>public</strong>
    </div>
    <dl>
      <div>
        <dt>version</dt>
        <dd>${escapeHtml(manifest.version)}</dd>
      </div>
      <div>
        <dt>records</dt>
        <dd>${manifest.recordCounts.apps} apps · ${manifest.recordCounts.officialDomains} domains · ${manifest.recordCounts.phishingConfirmed} phishing</dd>
      </div>
      <div>
        <dt>sha256</dt>
        <dd>${escapeHtml(manifest.sha256)}</dd>
      </div>
    </dl>
    <div class="manifest-foot">
      <code>GET /v1/open/manifest</code>
      <span>read-only</span>
    </div>
  </div>`
}

function render() {
  const activePanel =
    state.tab === "apps"
      ? renderApps()
      : state.tab === "phishing"
        ? renderPhishing()
        : renderApi()

  document.querySelector("#app")!.innerHTML = `<div class="shell">
    <header class="topbar">
      <a class="brand" href="#top" aria-label="SKUNKED Open Data">
        <span class="brand-mark">S</span>
        <span>open-data</span>
      </a>
      <nav>
        <a href="#dataset">Dataset</a>
        <a href="#api">API</a>
        <span class="command-pill"><kbd>⌘</kbd><kbd>K</kbd></span>
        <a href="https://github.com/AlienHub/skunked" target="_blank" rel="noreferrer">GitHub</a>
      </nav>
    </header>

    <main id="top">
      <section class="hero">
        <div class="hero-copy">
          <p class="eyebrow">Open dataset · Browser protection</p>
          <h1>SKUNKED Open Data</h1>
          <p class="lede">
            独立公开数据集，面向插件、SaaS 管理台与安全工具提供官方应用目录和人工确认钓鱼域名。
          </p>
          <div class="hero-actions">
            <a class="primary-action" href="#dataset">浏览数据</a>
            <a class="secondary-action" href="#api">查看 API</a>
          </div>
        </div>
        <div class="hero-visual">
          ${renderManifestPreview()}
        </div>
      </section>

      <section class="metrics" aria-label="数据集指标">
        ${renderMetric("Apps", manifest.recordCounts.apps, "protected software")}
        ${renderMetric("Official domains", manifest.recordCounts.officialDomains, "allowlist anchors")}
        ${renderMetric("Confirmed phishing", manifest.recordCounts.phishingConfirmed, "reviewed hosts")}
        ${renderMetric("Checksum", manifest.sha256.slice(0, 8), "sha256 prefix")}
      </section>

      <section class="workspace" id="dataset">
        <div class="toolbar">
          <div class="search-box">
            <span>/</span>
            <input id="query" value="${escapeHtml(state.query)}" placeholder="搜索应用、域名、关键词..." />
          </div>
          <div class="tabs" role="tablist">
            <button class="${state.tab === "apps" ? "active" : ""}" data-tab="apps">Apps</button>
            <button class="${state.tab === "phishing" ? "active" : ""}" data-tab="phishing">Phishing</button>
            <button class="${state.tab === "api" ? "active" : ""}" data-tab="api" id="api">API</button>
          </div>
        </div>
        ${activePanel}
      </section>
    </main>
  </div>`

  bindEvents()
}

function bindEvents() {
  document
    .querySelectorAll<HTMLButtonElement>("[data-tab]")
    .forEach((button) => {
      button.addEventListener("click", () => {
        state.tab = button.dataset.tab as typeof state.tab
        render()
      })
    })

  document
    .querySelectorAll<HTMLButtonElement>("[data-category]")
    .forEach((button) => {
      button.addEventListener("click", () => {
        state.category = button.dataset.category as typeof state.category
        render()
      })
    })

  const input = document.querySelector<HTMLInputElement>("#query")
  input?.addEventListener("input", (event) => {
    state.query = (event.target as HTMLInputElement).value
    render()
    document.querySelector<HTMLInputElement>("#query")?.focus()
  })
}

render()
