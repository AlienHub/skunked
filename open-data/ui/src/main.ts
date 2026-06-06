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
  import.meta.env.VITE_OPEN_DATA_API_BASE_URL || window.location.origin

const categoryLabels: Record<Category, string> = {
  office: "办公效率",
  communication: "沟通协作",
  remote_control: "远程控制",
  security: "安全工具"
}

const sourceLabels: Record<string, string> = {
  manual_review: "人工审核",
  caidongyun_iocs_20260605: "威胁情报月报"
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

function formatSource(value: string): string {
  return sourceLabels[value] || value
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
        const label = item === "all" ? "全部" : categoryLabels[item]
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
        <p class="eyebrow">官方应用登记</p>
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
        <p class="eyebrow">人工确认威胁域名</p>
        <h2 id="phishing-title">确认钓鱼域名</h2>
      </div>
      <span class="count">${filtered.length} / ${phishingRecords.length}</span>
    </div>
    <div class="table-wrap">
      <table>
        <thead>
          <tr>
            <th>域名</th>
            <th>目标应用</th>
            <th>来源</th>
            <th>审阅时间</th>
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
                <td>${escapeHtml(formatSource(record.source))}</td>
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
    ["GET", "/v1/open/manifest", "版本、计数与校验值"],
    ["GET", "/v1/open/apps", "官方应用目录"],
    ["GET", "/v1/open/phishing", "确认钓鱼域名分页"],
    ["GET", "/v1/open/lookup?host=dingtalk.com", "主机名命中查询"]
  ]

  return `<section class="panel api-panel" aria-labelledby="api-title">
    <div class="panel-head">
      <div>
        <p class="eyebrow">公开只读接口</p>
        <h2 id="api-title">开放数据接口</h2>
      </div>
      <span class="count">无需密钥</span>
    </div>
    <div class="endpoint-list">
      ${endpoints
        .map(([method, path, desc]) => {
          const endpointUrl = new URL(path, apiBase).toString()
          return `<div class="endpoint">
            <span>${method}</span>
            <a href="${escapeHtml(endpointUrl)}" target="_blank" rel="noreferrer">
              <code>${escapeHtml(endpointUrl)}</code>
            </a>
            <p>${escapeHtml(desc)}</p>
          </div>`
        })
        .join("")}
    </div>
    <div class="code-slab">
      <span>基础地址</span>
      <code>${escapeHtml(apiBase)}</code>
    </div>
  </section>`
}

function renderManifestPreview() {
  return `<div class="manifest-preview" aria-label="数据集版本摘要">
    <div class="manifest-head">
      <span>数据集清单</span>
      <strong>公开</strong>
    </div>
    <dl>
      <div>
        <dt>版本</dt>
        <dd>${escapeHtml(manifest.version)}</dd>
      </div>
      <div>
        <dt>记录</dt>
        <dd>${manifest.recordCounts.apps} 个应用 · ${manifest.recordCounts.officialDomains} 个官方域名 · ${manifest.recordCounts.phishingConfirmed} 个钓鱼域名</dd>
      </div>
      <div>
        <dt>校验值</dt>
        <dd>${escapeHtml(manifest.sha256)}</dd>
      </div>
    </dl>
    <div class="manifest-foot">
      <code>GET /v1/open/manifest</code>
      <span>只读</span>
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
      <a class="brand" href="#top" aria-label="SKUNKED 公开数据">
        <span>公开数据</span>
      </a>
      <nav>
        <a href="https://github.com/AlienHub/skunked" target="_blank" rel="noreferrer">GitHub</a>
      </nav>
    </header>

    <main id="top">
      <section class="hero">
        <div class="hero-copy">
          <p class="eyebrow">公开数据集 · 浏览器防护</p>
          <h1>SKUNKED 公开数据</h1>
          <p class="lede">
            独立公开数据集，面向插件、企业管理台与安全工具提供官方应用目录和人工确认钓鱼域名。
          </p>
          <div class="hero-actions">
            <a class="primary-action" href="#dataset">浏览数据</a>
            <a class="secondary-action" href="#api">查看接口</a>
          </div>
        </div>
        <div class="hero-visual">
          ${renderManifestPreview()}
        </div>
      </section>

      <section class="metrics" aria-label="数据集指标">
        ${renderMetric("应用", manifest.recordCounts.apps, "受保护软件")}
        ${renderMetric("官方域名", manifest.recordCounts.officialDomains, "白名单锚点")}
        ${renderMetric("钓鱼域名", manifest.recordCounts.phishingConfirmed, "人工确认主机")}
        ${renderMetric("校验值", manifest.sha256.slice(0, 8), "SHA-256 前缀")}
      </section>

      <section class="workspace" id="dataset">
        <div class="toolbar">
          <div class="search-box">
            <input id="query" value="${escapeHtml(state.query)}" placeholder="搜索应用、域名、关键词..." />
          </div>
          <div class="tabs" role="tablist">
            <button class="${state.tab === "apps" ? "active" : ""}" data-tab="apps">应用目录</button>
            <button class="${state.tab === "phishing" ? "active" : ""}" data-tab="phishing">钓鱼域名</button>
            <button class="${state.tab === "api" ? "active" : ""}" data-tab="api" id="api">开放接口</button>
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
    const target = event.target as HTMLInputElement
    const selectionStart = target.selectionStart
    const selectionEnd = target.selectionEnd

    state.query = target.value
    render()
    const nextInput = document.querySelector<HTMLInputElement>("#query")
    nextInput?.focus()
    if (selectionStart !== null && selectionEnd !== null) {
      nextInput?.setSelectionRange(selectionStart, selectionEnd)
    }
  })
}

render()
