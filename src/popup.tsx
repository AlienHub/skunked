import { useEffect, useState } from "react"

import "./style.css"

interface Stats {
  totalScans: number
  phishingBlocked: number
  warningShown: number
  officialVerified: number
}

interface AnalysisResult {
  status: "safe" | "warning" | "blocked" | "pending"
  result?: {
    isPhishing: boolean
    confidence: number
    reason: string
    matchedSoftware?: {
      name: string
      officialDomains: string[]
    }
  }
}

function getStatusMeta(status?: AnalysisResult["status"]) {
  if (status === "blocked") {
    return {
      tone: "danger",
      badge: "已拦截",
      title: "已阻止可疑页面",
      description: "此页面存在仿冒或诱导下载风险，建议从官方站点重新访问。"
    }
  }

  if (status === "warning") {
    return {
      tone: "warning",
      badge: "需留意",
      title: "发现可疑信号",
      description: "页面可能不是官方站点，下载前请确认域名来源。"
    }
  }

  if (status === "safe") {
    return {
      tone: "safe",
      badge: "未发现风险",
      title: "当前页面未触发风险",
      description: "已完成本地规则和受保护品牌域名检查。"
    }
  }

  return {
    tone: "neutral",
    badge: "检测中",
    title: "正在检查当前页面",
    description: "若发现仿冒下载页或可疑域名，会自动提示。"
  }
}

function IndexPopup() {
  const [stats, setStats] = useState<Stats>({
    totalScans: 0,
    phishingBlocked: 0,
    warningShown: 0,
    officialVerified: 0
  })
  const [currentPageStatus, setCurrentPageStatus] =
    useState<AnalysisResult | null>(null)

  useEffect(() => {
    chrome.storage.local.get(["stats"], (data) => {
      if (data.stats) setStats(data.stats)
    })

    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      const tabId = tabs[0]?.id
      if (!tabId) return

      chrome.storage.local.get(`analysis_${tabId}`, (data) => {
        if (data[`analysis_${tabId}`]) {
          setCurrentPageStatus(data[`analysis_${tabId}`])
        }
      })
    })
  }, [])

  const meta = getStatusMeta(currentPageStatus?.status)
  const result = currentPageStatus?.result

  return (
    <div className="popup-shell">
      <header className="topbar">
        <div className="brand-mark" aria-hidden="true">
          KJ
        </div>
        <div className="brand-copy">
          <h1>空军</h1>
          <p>反钓鱼防护</p>
        </div>
        <span className={`status-badge ${meta.tone}`}>{meta.badge}</span>
      </header>

      <main>
        <section className={`status-panel ${meta.tone}`}>
          <div className="status-head">
            <span className="status-dot" aria-hidden="true" />
            <h2>{meta.title}</h2>
          </div>
          <p>{result?.reason || meta.description}</p>

          {result?.matchedSoftware || result?.confidence ? (
            <dl className="status-meta">
              {result?.matchedSoftware ? (
                <div>
                  <dt>目标品牌</dt>
                  <dd>{result.matchedSoftware.name}</dd>
                </div>
              ) : null}
              {result?.confidence ? (
                <div>
                  <dt>置信度</dt>
                  <dd>{result.confidence}%</dd>
                </div>
              ) : null}
            </dl>
          ) : null}
        </section>

        <section className="section-block">
          <div className="section-heading">
            <h2>防护统计</h2>
            <span>本机累计</span>
          </div>
          <div className="metric-grid">
            <div className="metric-cell">
              <strong>{stats.totalScans}</strong>
              <span>已检查</span>
            </div>
            <div className="metric-cell">
              <strong>{stats.phishingBlocked}</strong>
              <span>已阻断</span>
            </div>
            <div className="metric-cell">
              <strong>{stats.warningShown}</strong>
              <span>已提醒</span>
            </div>
            <div className="metric-cell">
              <strong>{stats.officialVerified}</strong>
              <span>官方域</span>
            </div>
          </div>
        </section>
      </main>

      <footer className="popup-actions">
        <button type="button" onClick={() => chrome.runtime.openOptionsPage()}>
          设置
        </button>
      </footer>
    </div>
  )
}

export default IndexPopup
