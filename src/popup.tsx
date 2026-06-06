import "./style.css"

import { useEffect, useState } from "react"

interface Stats {
  totalScans: number
  phishingBlocked: number
  warningShown: number
  officialVerified: number
}

interface PageStatus {
  status: "safe" | "warning" | "blocked" | "pending"
  result?: {
    reason: string
    confidence: number
    matchedBrand?: string
  }
}

interface RuntimeInfo {
  datasetVersion?: string
}

function statusMeta(status: PageStatus["status"]) {
  if (status === "blocked") {
    return {
      label: "已阻止风险",
      tone: "danger" as const,
      icon: "!",
      title: "已为你拦截疑似钓鱼页面",
      description: "建议通过官方入口重新访问或下载软件。"
    }
  }
  if (status === "warning") {
    return {
      label: "需要留意",
      tone: "warning" as const,
      icon: "?",
      title: "此页面存在仿冒风险",
      description: "如果要下载办公或远控软件，请优先前往官网。"
    }
  }
  if (status === "safe") {
    return {
      label: "基础防护中",
      tone: "safe" as const,
      icon: "✓",
      title: "未发现目标钓鱼风险",
      description: "SKUNKED 正在本地检查高仿软件下载页和可疑域名。"
    }
  }
  return {
    label: "基础防护中",
    tone: "neutral" as const,
    icon: "·",
    title: "正在保护当前浏览",
    description: "遇到高仿软件下载页时会自动告警或阻断。"
  }
}

function IndexPopup() {
  const [stats, setStats] = useState<Stats>({
    totalScans: 0,
    phishingBlocked: 0,
    warningShown: 0,
    officialVerified: 0
  })
  const [pageStatus, setPageStatus] = useState<PageStatus>({
    status: "pending"
  })
  const [runtime, setRuntime] = useState<RuntimeInfo>({
  })

  useEffect(() => {
    chrome.storage.local.get(["stats"], (data) => {
      if (data.stats) {
        setStats(data.stats)
      }
    })

    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      const tabId = tabs?.[0]?.id
      if (!tabId) return
      chrome.storage.local.get(`analysis_${tabId}`, (data) => {
        if (data[`analysis_${tabId}`]) {
          setPageStatus(data[`analysis_${tabId}`])
        }
      })
    })

    chrome.runtime.sendMessage({ action: "get_runtime_info" }, (response) => {
      if (response?.success && response?.data) {
        setRuntime(response.data)
      }
    })
  }, [])

  const meta = statusMeta(pageStatus.status)

  return (
    <div className="popup-root">
      <header className="popup-header">
        <div>
          <h1>SKUNKED</h1>
          <p>反钓鱼防护</p>
        </div>
        <span className={`badge badge-${meta.tone}`}>{meta.label}</span>
      </header>

      <section className={`card card-${meta.tone}`}>
        <div className="status-row">
          <span className="status-icon">{meta.icon}</span>
          <div>
            <p className="status-title">{meta.title}</p>
            <p className="status-desc">
              {pageStatus.result?.reason || meta.description}
            </p>
          </div>
        </div>
        {pageStatus.status !== "safe" && !!pageStatus.result?.confidence && (
          <p className="confidence">置信度 {pageStatus.result.confidence}%</p>
        )}
      </section>

      <section className="card">
        <h2>防护统计</h2>
        <div className="metric-grid">
          <div className="metric">
            <span>{stats.phishingBlocked}</span>
            <small>已阻止</small>
          </div>
          <div className="metric">
            <span>{stats.warningShown}</span>
            <small>告警</small>
          </div>
          <div className="metric">
            <span>{stats.officialVerified}</span>
            <small>官方验证</small>
          </div>
          <div className="metric">
            <span>{stats.totalScans}</span>
            <small>已检查</small>
          </div>
        </div>
      </section>

      <section className="card">
        <h2>数据集</h2>
        <p className="tenant-line">
          数据集版本：{runtime.datasetVersion || "fallback-local-v1"}
        </p>
      </section>

      <footer className="popup-footer">
        <button
          className="ghost-btn"
          onClick={() => chrome.runtime.openOptionsPage()}
        >
          设置
        </button>
      </footer>
    </div>
  )
}

export default IndexPopup
