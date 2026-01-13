import { useState, useEffect } from "react"
import "./style.css"

interface Stats {
  totalScans: number
  phishingBlocked: number
  warningShown: number
  officialVerified: number
}

interface Settings {
  enableAI: boolean
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

function IndexPopup() {
  const [stats, setStats] = useState<Stats>({
    totalScans: 0,
    phishingBlocked: 0,
    warningShown: 0,
    officialVerified: 0
  })
  const [settings, setSettings] = useState<Settings>({ enableAI: false })
  const [currentPageStatus, setCurrentPageStatus] = useState<AnalysisResult | null>(null)
  const [currentTabId, setCurrentTabId] = useState<number | null>(null)

  useEffect(() => {
    // Load stats and settings
    chrome.storage.local.get(["stats", "settings"], (data) => {
      if (data.stats) setStats(data.stats)
      if (data.settings) setSettings(data.settings)
    })

    // Get current tab
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs[0]?.id) {
        const tabId = tabs[0].id
        setCurrentTabId(tabId)

        // Get current page status
        chrome.storage.local.get(`analysis_${tabId}`, (data) => {
          if (data[`analysis_${tabId}`]) {
            setCurrentPageStatus(data[`analysis_${tabId}`])
          }
        })
      }
    })
  }, [])

  const openOptions = () => {
    chrome.runtime.openOptionsPage()
  }

  const getStatusIcon = (status?: string) => {
    switch (status) {
      case "safe":
        return "✅"
      case "warning":
        return "⚠️"
      case "blocked":
        return "🛡️"
      default:
        return "ℹ️"
    }
  }

  const getStatusText = (status?: string) => {
    switch (status) {
      case "safe":
        return "安全"
      case "warning":
        return "可疑"
      case "blocked":
        return "已拦截"
      default:
        return "未检测"
    }
  }

  const getStatusColor = (status?: string) => {
    switch (status) {
      case "safe":
        return "#16a34a"
      case "warning":
        return "#f59e0b"
      case "blocked":
        return "#dc2626"
      default:
        return "#6b7280"
    }
  }

  return (
    <div className="plasmo-container">
      {/* Header */}
      <div className="header">
        <div className="logo">
          <span className="logo-icon">🛡️</span>
          <div>
            <h1>空军</h1>
            <p className="subtitle">AI 反钓鱼卫士</p>
          </div>
        </div>
      </div>

      {/* Vision Section */}
      <div className="vision-section">
        <p className="vision-text">
          用 AI 技术守护您的网络安全，抵御钓鱼网站和恶意软件威胁。
        </p>
      </div>

      {/* Current Page Status */}
      <div className="section">
        <h3 className="section-title">当前页面</h3>
        <div
          className="status-card"
          style={{
            borderLeft: `4px solid ${getStatusColor(currentPageStatus?.status)}`
          }}
        >
          <div className="status-header">
            <span className="status-icon">{getStatusIcon(currentPageStatus?.status)}</span>
            <span
              className="status-text"
              style={{ color: getStatusColor(currentPageStatus?.status) }}
            >
              {getStatusText(currentPageStatus?.status)}
            </span>
          </div>
          {currentPageStatus?.result && (
            <div className="status-details">
              {currentPageStatus.result.matchedSoftware && (
                <p className="detail-item">
                  <strong>识别软件：</strong>
                  {currentPageStatus.result.matchedSoftware.name}
                </p>
              )}
              <p className="detail-item">
                <strong>判定依据：</strong>
                {currentPageStatus.result.reason}
              </p>
              {currentPageStatus.result.confidence > 0 && (
                <p className="detail-item">
                  <strong>置信度：</strong>
                  {currentPageStatus.result.confidence}%
                </p>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Stats Section */}
      <div className="section">
        <h3 className="section-title">防护统计</h3>
        <div className="stats-grid">
          <div className="stat-item">
            <div className="stat-value">{stats.totalScans}</div>
            <div className="stat-label">扫描次数</div>
          </div>
          <div className="stat-item danger">
            <div className="stat-value">{stats.phishingBlocked}</div>
            <div className="stat-label">拦截钓鱼</div>
          </div>
          <div className="stat-item warning">
            <div className="stat-value">{stats.warningShown}</div>
            <div className="stat-label">警告提示</div>
          </div>
          <div className="stat-item safe">
            <div className="stat-value">{stats.officialVerified}</div>
            <div className="stat-label">安全认证</div>
          </div>
        </div>
      </div>

      {/* AI Configuration Notice */}
      <div className="ai-notice">
        {!settings.enableAI ? (
          <div className="ai-notice-card warning">
            <span className="notice-icon">⚠️</span>
            <div className="notice-content">
              <p className="notice-title">AI 检测未启用</p>
              <p className="notice-desc">
                配置 AI API Key 可提升检测准确率，拦截更精准的钓鱼网站
              </p>
              <button className="btn btn-primary" onClick={openOptions}>
                前往配置
              </button>
            </div>
          </div>
        ) : (
          <div className="ai-notice-card success">
            <span className="notice-icon">✅</span>
            <div className="notice-content">
              <p className="notice-title">AI 检测已启用</p>
              <p className="notice-desc">
                AI 正在保护您的网络安全，智能识别钓鱼网站
              </p>
              <button className="btn btn-secondary" onClick={openOptions}>
                管理配置
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="footer">
        <p className="footer-text">
          空军 v0.1.0 • 三层过滤 • AI 智能防护
        </p>
      </div>
    </div>
  )
}

export default IndexPopup
