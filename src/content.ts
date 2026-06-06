import { extractDOMContent } from "./services/domExtractor"

export {}

interface RiskUiPayload {
  softwareName: string
  officialUrl: string
  reason: string
  confidence: number
  datasetVersion?: string
}

let badgeContainer: HTMLDivElement | null = null
let panelVisible = false

function escapeHtml(text: string): string {
  return text
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;")
}

function removeById(id: string) {
  const node = document.getElementById(id)
  if (node) node.remove()
}

function ensureBadge(payload: RiskUiPayload & { level: "block" | "warn" }) {
  const safeReason = escapeHtml(payload.reason)
  const safeSoftwareName = escapeHtml(payload.softwareName)

  if (!badgeContainer) {
    badgeContainer = document.createElement("div")
    badgeContainer.id = "skunked-risk-badge"
    badgeContainer.style.cssText = [
      "position:fixed",
      "right:16px",
      "bottom:16px",
      "z-index:2147483647",
      "font-family:Inter,-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif"
    ].join(";")
    document.body.appendChild(badgeContainer)
  }

  const accent = payload.level === "block" ? "#dc2626" : "#f59e0b"
  const title = payload.level === "block" ? "高风险网站" : "风险提醒"

  badgeContainer.innerHTML = `
    <button id="skunked-toggle-panel" style="
      border:none;
      background:${accent};
      color:#fff;
      padding:10px 14px;
      border-radius:999px;
      font-size:12px;
      font-weight:600;
      box-shadow:0 10px 24px rgba(0,0,0,.18);
      cursor:pointer;
    ">
      SKUNKED 防护 · ${title}
    </button>
    <div id="skunked-floating-panel" style="
      margin-top:8px;
      width:280px;
      background:#fff;
      border:1px solid #e5e7eb;
      border-radius:12px;
      box-shadow:0 14px 34px rgba(0,0,0,.16);
      padding:12px;
      display:${panelVisible ? "block" : "none"};
      color:#111827;
      font-size:12px;
      line-height:1.5;
    ">
      <div style="font-weight:700;margin-bottom:6px;">${title}</div>
      <div style="color:#4b5563;">${safeReason}</div>
      <div style="margin-top:8px;color:#6b7280;">置信度 ${payload.confidence}% · ${safeSoftwareName}</div>
      <a href="${payload.officialUrl}" target="_blank" rel="noopener noreferrer" style="
        margin-top:10px;
        display:inline-block;
        text-decoration:none;
        color:#fff;
        background:${accent};
        border-radius:8px;
        padding:6px 10px;
        font-weight:600;
      ">前往官网</a>
    </div>
  `

  const toggle = badgeContainer.querySelector<HTMLButtonElement>(
    "#skunked-toggle-panel"
  )
  if (toggle) {
    toggle.onclick = () => {
      panelVisible = !panelVisible
      ensureBadge(payload)
    }
  }
}

function injectBlockOverlay(data: RiskUiPayload) {
  const safeSoftwareName = escapeHtml(data.softwareName)
  const safeReason = escapeHtml(data.reason)
  const safeOfficialUrl = escapeHtml(data.officialUrl)
  removeById("skunked-warning-bar")
  removeById("skunked-overlay")

  const container = document.createElement("div")
  container.id = "skunked-overlay"
  container.style.cssText = [
    "position:fixed",
    "inset:0",
    "z-index:2147483646",
    "background:rgba(3,7,18,.68)",
    "backdrop-filter:blur(2px)",
    "display:flex",
    "align-items:center",
    "justify-content:center",
    "padding:24px",
    "font-family:Inter,-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif"
  ].join(";")

  container.innerHTML = `
    <div style="
      max-width:560px;
      width:100%;
      border-radius:16px;
      background:#fff;
      border:1px solid #fee2e2;
      box-shadow:0 24px 48px rgba(0,0,0,.24);
      padding:24px;
      color:#111827;
    ">
      <div style="display:flex;align-items:center;gap:10px;margin-bottom:10px;">
        <div style="width:10px;height:10px;border-radius:999px;background:#dc2626;"></div>
        <div style="font-size:14px;font-weight:700;color:#dc2626;">已阻止访问疑似钓鱼页面</div>
      </div>
      <h2 style="margin:0 0 8px 0;font-size:20px;">页面疑似冒充 ${safeSoftwareName}</h2>
      <p style="margin:0 0 12px 0;color:#4b5563;line-height:1.65;">${safeReason}</p>
      <p style="margin:0 0 16px 0;color:#6b7280;font-size:13px;">
        SKUNKED 免费基础防护已为你拦截本次访问。建议通过官方入口重新打开。
      </p>
      <div style="display:flex;gap:10px;flex-wrap:wrap;">
        <a href="${safeOfficialUrl}" target="_blank" rel="noopener noreferrer" style="
          background:#16a34a;
          color:#fff;
          text-decoration:none;
          padding:11px 16px;
          border-radius:10px;
          font-weight:700;
          font-size:13px;
        ">前往 ${safeSoftwareName} 官网</a>
        <button id="skunked-continue-btn" style="
          background:#fff;
          color:#6b7280;
          border:1px solid #d1d5db;
          padding:10px 14px;
          border-radius:10px;
          font-weight:500;
          font-size:12px;
          cursor:pointer;
        ">继续访问</button>
      </div>
    </div>
  `

  document.body.appendChild(container)

  const continueButton = container.querySelector<HTMLButtonElement>(
    "#skunked-continue-btn"
  )
  if (continueButton) {
    continueButton.onclick = () => {
      container.remove()
      chrome.runtime.sendMessage({
        action: "risk_bypassed",
        data: {
          confidence: data.confidence,
          reason: data.reason,
          softwareName: data.softwareName,
          datasetVersion: data.datasetVersion
        }
      })
      ensureBadge({ ...data, level: "block" })
    }
  }
}

function injectWarningBar(data: RiskUiPayload) {
  const safeSoftwareName = escapeHtml(data.softwareName)
  const safeReason = escapeHtml(data.reason)
  const safeOfficialUrl = escapeHtml(data.officialUrl)
  removeById("skunked-warning-bar")
  removeById("skunked-overlay")

  const bar = document.createElement("div")
  bar.id = "skunked-warning-bar"
  bar.style.cssText = [
    "position:fixed",
    "top:12px",
    "left:50%",
    "transform:translateX(-50%)",
    "z-index:2147483646",
    "width:min(880px,calc(100vw - 24px))",
    "background:#fff",
    "border:1px solid #fde68a",
    "border-radius:12px",
    "box-shadow:0 18px 32px rgba(0,0,0,.14)",
    "padding:10px 12px",
    "font-family:Inter,-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif"
  ].join(";")

  bar.innerHTML = `
    <div style="display:flex;gap:10px;align-items:center;color:#111827;">
      <div style="width:8px;height:8px;border-radius:999px;background:#f59e0b;flex-shrink:0;"></div>
      <div style="font-size:13px;line-height:1.4;flex:1;">
        此站点可能并非 <strong>${safeSoftwareName}</strong> 官方页面。${safeReason}
      </div>
      <a href="${safeOfficialUrl}" target="_blank" rel="noopener noreferrer" style="
        text-decoration:none;
        background:#111827;
        color:#fff;
        padding:7px 10px;
        border-radius:8px;
        font-size:12px;
        font-weight:600;
      ">去官网</a>
      <button id="skunked-dismiss-warning" style="
        border:none;
        background:#f3f4f6;
        color:#4b5563;
        width:28px;
        height:28px;
        border-radius:8px;
        cursor:pointer;
      ">×</button>
    </div>
  `

  document.body.appendChild(bar)

  const dismiss = bar.querySelector<HTMLButtonElement>(
    "#skunked-dismiss-warning"
  )
  if (dismiss) {
    dismiss.onclick = () => {
      bar.remove()
      ensureBadge({ ...data, level: "warn" })
    }
  }
}

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "extract_dom") {
    try {
      sendResponse({
        success: true,
        domContent: extractDOMContent()
      })
    } catch (error) {
      sendResponse({
        success: false,
        error: String(error)
      })
    }
    return true
  }

  if (request.action === "inject_overlay") {
    injectBlockOverlay(request.data)
    sendResponse({ success: true })
    return true
  }

  if (request.action === "inject_warning") {
    injectWarningBar(request.data)
    sendResponse({ success: true })
    return true
  }

  return false
})
