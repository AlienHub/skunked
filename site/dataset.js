const API_BASE =
  new URLSearchParams(window.location.search).get("api") ||
  "https://skunked-open-data.zhouxiansheng1958.workers.dev"

const state = {
  apps: [],
  page: 1,
  pageSize: 20,
  totalPages: 1,
  q: "",
  targetAppId: ""
}

function observeFadeIn() {
  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add("visible")
          observer.unobserve(entry.target)
        }
      })
    },
    { threshold: 0.12 }
  )

  document.querySelectorAll(".fade-in").forEach((node) => observer.observe(node))
}

function setText(id, value) {
  const node = document.getElementById(id)
  if (!node) return
  node.textContent = String(value)
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;")
}

function formatDate(input) {
  if (!input) return "--"
  const date = new Date(input)
  if (Number.isNaN(date.getTime())) return "--"
  return date.toLocaleString()
}

async function fetchJson(path, params = {}) {
  const url = new URL(`${API_BASE.replace(/\/$/, "")}${path}`)
  Object.entries(params).forEach(([key, value]) => {
    if (value === undefined || value === null || value === "") return
    url.searchParams.set(key, String(value))
  })

  const response = await fetch(url.toString())
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`)
  }

  return response.json()
}

function renderAppsTable() {
  const body = document.getElementById("apps-body")
  if (!body) return

  body.innerHTML = state.apps
    .map((app) => {
      const domains = (app.officialDomains || [])
        .map((domain) => `<span class="code">${escapeHtml(domain)}</span>`)
        .join("<br />")

      const keywords = (app.keywords || [])
        .slice(0, 6)
        .map((keyword) => escapeHtml(keyword))
        .join(" · ")

      return `<tr>
        <td>
          <strong>${escapeHtml(app.name)}</strong><br />
          <span class="code">${escapeHtml(app.id)}</span>
        </td>
        <td>${escapeHtml(app.category || "-")}</td>
        <td>${domains || "-"}</td>
        <td>${keywords || "-"}</td>
      </tr>`
    })
    .join("")
}

function renderAppFilter() {
  const select = document.getElementById("app-filter")
  if (!select) return

  select.innerHTML =
    '<option value="">全部目标应用</option>' +
    state.apps
      .map(
        (app) =>
          `<option value="${escapeHtml(app.id)}">${escapeHtml(app.name)}</option>`
      )
      .join("")

  select.value = state.targetAppId
}

function renderPhishingRows(items) {
  const body = document.getElementById("phishing-body")
  if (!body) return

  if (!items.length) {
    body.innerHTML =
      '<tr><td colspan="4" style="color:#64748b;">暂无匹配记录</td></tr>'
    return
  }

  const appMap = new Map(state.apps.map((app) => [app.id, app.name]))

  body.innerHTML = items
    .map((item) => {
      const targetName = item.targetAppId ? appMap.get(item.targetAppId) || item.targetAppId : "--"

      return `<tr>
        <td><span class="code">${escapeHtml(item.domain)}</span></td>
        <td>${escapeHtml(targetName)}</td>
        <td>${escapeHtml(item.source || "manual_review")}</td>
        <td>${escapeHtml(formatDate(item.reviewedAt))}</td>
      </tr>`
    })
    .join("")
}

function updatePaginationMeta(page, totalPages, total) {
  setText("page-info", `第 ${page} / ${totalPages || 1} 页 · 共 ${total} 条`)

  const prevButton = document.getElementById("prev-page")
  const nextButton = document.getElementById("next-page")

  if (prevButton) prevButton.disabled = page <= 1
  if (nextButton) nextButton.disabled = page >= totalPages
}

async function loadManifest() {
  const manifest = await fetchJson("/v1/open/manifest")
  setText("dataset-version", manifest.version || "uninitialized")
  setText("dataset-updated", manifest.generatedAt ? formatDate(manifest.generatedAt) : "--")
  setText("dataset-api", API_BASE)
}

async function loadApps() {
  const data = await fetchJson("/v1/open/apps")
  state.apps = Array.isArray(data.items) ? data.items : []
  renderAppsTable()
  renderAppFilter()
}

async function loadPhishing() {
  const payload = await fetchJson("/v1/open/phishing", {
    status: "confirmed",
    page: state.page,
    pageSize: state.pageSize,
    q: state.q,
    targetAppId: state.targetAppId
  })

  const items = Array.isArray(payload.items) ? payload.items : []
  const totalPages = payload?.pagination?.totalPages || 1
  const total = payload?.pagination?.total || items.length

  state.totalPages = totalPages
  renderPhishingRows(items)
  updatePaginationMeta(state.page, totalPages, total)
}

async function refreshAll() {
  try {
    await loadManifest()
    await loadApps()
    await loadPhishing()
  } catch (error) {
    setText("dataset-version", "offline")
    setText("dataset-updated", "--")
    setText("page-info", "加载失败，请稍后重试")
  }
}

function bindEvents() {
  const searchInput = document.getElementById("query")
  const appFilter = document.getElementById("app-filter")
  const refreshButton = document.getElementById("refresh")
  const prevButton = document.getElementById("prev-page")
  const nextButton = document.getElementById("next-page")

  if (searchInput) {
    searchInput.addEventListener("input", async (event) => {
      state.q = event.target.value.trim()
      state.page = 1
      await loadPhishing()
    })
  }

  if (appFilter) {
    appFilter.addEventListener("change", async (event) => {
      state.targetAppId = event.target.value
      state.page = 1
      await loadPhishing()
    })
  }

  if (refreshButton) {
    refreshButton.addEventListener("click", async () => {
      await refreshAll()
    })
  }

  if (prevButton) {
    prevButton.addEventListener("click", async () => {
      state.page = Math.max(1, state.page - 1)
      await loadPhishing()
    })
  }

  if (nextButton) {
    nextButton.addEventListener("click", async () => {
      state.page = Math.min(state.totalPages, state.page + 1)
      await loadPhishing()
    })
  }
}

observeFadeIn()
bindEvents()
refreshAll()
