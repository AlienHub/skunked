import { extractDOMContent } from "./services/domExtractor"
import { PhishingAnalysisResult } from "./types"

export {}

console.log("空军 Content Script 已加载")

let analysisResult: PhishingAnalysisResult | null = null
let overlayRoot: any = null
let warningRoot: any = null
let floatingBallData: any = null // Store data for floating ball

// Extract DOM content when page is ready
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", extractAndSend)
} else {
  extractAndSend()
}

function extractAndSend() {
  console.log("提取DOM内容")
  try {
    const domContent = extractDOMContent()

    // Send to background for analysis
    chrome.runtime.sendMessage(
      {
        action: "extract_dom",
        domContent
      },
      (response) => {
        console.log("DOM提取响应:", response)
      }
    )
  } catch (error) {
    console.error("DOM提取失败:", error)
  }
}

// Listen for messages from background
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  console.log("Content script收到消息:", request)

  if (request.action === "extract_dom") {
    try {
      const domContent = extractDOMContent()
      sendResponse({ success: true, domContent })
    } catch (error) {
      sendResponse({ success: false, error: String(error) })
    }
    return true
  }

  if (request.action === "inject_overlay") {
    injectRedOverlay(request.data)
    sendResponse({ success: true })
    return true
  }

  if (request.action === "inject_warning") {
    injectYellowWarning(request.data)
    sendResponse({ success: true })
    return true
  }

  if (request.action === "save_analysis_result") {
    analysisResult = request.data
    sendResponse({ success: true })
    return true
  }

  if (request.action === "get_page_status") {
    if (analysisResult) {
      sendResponse({
        status: analysisResult.isPhishing
          ? analysisResult.confidence >= 90
            ? "blocked"
            : "warning"
          : "safe",
        result: analysisResult
      })
    } else {
      sendResponse({ status: "pending" })
    }
    return true
  }

  return false
})

function injectRedOverlay(data: any) {
  // Remove existing overlay if present
  const existing = document.getElementById("kongjun-overlay")
  if (existing) {
    existing.remove()
  }

  // Store data for floating ball
  floatingBallData = { ...data, type: "danger" }

  // Create overlay container with browser-native style
  const container = document.createElement("div")
  container.id = "kongjun-overlay"
  document.body.appendChild(container)

  // Browser-native phishing warning style (similar to Edge/Chrome)
  container.innerHTML = `
    <div style="
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background: #202124;
      z-index: 999999;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
    ">
      <!-- Warning Icon -->
      <div style="
        width: 64px;
        height: 64px;
        background: #d93025;
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
        margin-bottom: 24px;
      ">
        <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
          <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path>
          <line x1="12" y1="9" x2="12" y2="13"></line>
          <line x1="12" y1="17" x2="12.01" y2="17"></line>
        </svg>
      </div>

      <!-- Main Title -->
      <h1 style="
        color: #d93025;
        font-size: 32px;
        font-weight: 500;
        margin: 0 0 16px 0;
        text-align: center;
      ">
        安全警告
      </h1>

      <!-- Subtitle -->
      <p style="
        color: #9aa0a6;
        font-size: 16px;
        margin: 0 0 32px 0;
        text-align: center;
      ">
        前往的网站可能含有安全风险
      </p>

      <!-- Content Card -->
      <div style="
        background: #292a2d;
        border: 1px solid #3c4043;
        border-radius: 8px;
        max-width: 600px;
        width: 90%;
        padding: 24px;
        margin-bottom: 24px;
      ">
        <p style="
          color: #e8eaed;
          font-size: 14px;
          line-height: 1.6;
          margin: 0 0 16px 0;
        ">
          检测到该网站正在伪造 <strong style="color: #8ab4f8;">${data.softwareName}</strong> 官方网站，
          这可能是钓鱼网站，试图窃取您的个人信息或传播恶意软件。
        </p>

        <div style="
          background: rgba(217, 48, 37, 0.1);
          border-left: 3px solid #d93025;
          padding: 12px 16px;
          margin: 16px 0;
          border-radius: 4px;
        ">
          <p style="
            color: #f28b82;
            font-size: 13px;
            margin: 0 0 8px 0;
          ">
            <strong>判定依据：</strong>${data.reason}
          </p>
          <p style="
            color: #f28b82;
            font-size: 13px;
            margin: 0;
          ">
            <strong>置信度：</strong>${data.confidence}%
          </p>
        </div>

        <p style="
          color: #9aa0a6;
          font-size: 13px;
          margin: 16px 0 0 0;
          line-height: 1.5;
        ">
          建议您立即离开此页面，通过官方渠道下载软件。
        </p>
      </div>

      <!-- Action Buttons -->
      <div style="
        display: flex;
        gap: 12px;
        flex-wrap: wrap;
        justify-content: center;
        max-width: 600px;
        width: 90%;
      ">
        <a
          href="${data.officialUrl}"
          target="_blank"
          rel="noopener noreferrer"
          style="
            display: inline-flex;
            align-items: center;
            justify-content: center;
            background: #8ab4f8;
            color: #202124;
            padding: 10px 24px;
            border-radius: 4px;
            text-decoration: none;
            font-size: 14px;
            font-weight: 500;
            border: none;
            cursor: pointer;
            transition: background 0.2s;
          "
          onmouseover="this.style.background='#aecbfa'"
          onmouseout="this.style.background='#8ab4f8'"
        >
          前往官方网站
        </a>

        <button
          id="kongjun-proceed-btn"
          style="
            display: inline-flex;
            align-items: center;
            justify-content: center;
            background: transparent;
            color: #8ab4f8;
            padding: 10px 24px;
            border: 1px solid #8ab4f8;
            border-radius: 4px;
            font-size: 14px;
            font-weight: 500;
            cursor: pointer;
            transition: all 0.2s;
          "
          onmouseover="this.style.background='rgba(138, 180, 248, 0.1)'"
          onmouseout="this.style.background='transparent'"
        >
          忽略警告，继续访问
        </button>
      </div>

      <!-- Footer -->
      <p style="
        color: #5f6368;
        font-size: 12px;
        margin-top: 32px;
        text-align: center;
      ">
        空军反钓鱼卫士 • AI 智能防护
      </p>
    </div>
  `

  // Attach event listener for proceed button - show floating ball instead of removing
  const proceedBtn = container.querySelector('#kongjun-proceed-btn')
  if (proceedBtn) {
    proceedBtn.addEventListener('click', () => {
      // Fade out overlay
      container.style.opacity = '0'
      container.style.transition = 'opacity 0.3s'

      setTimeout(() => {
        container.remove()
        // Show floating ball after overlay is removed
        showFloatingBall()
      }, 300)
    })
  }
}

function injectYellowWarning(data: any) {
  // Remove existing warning if present
  const existing = document.getElementById("kongjun-warning")
  if (existing) {
    existing.remove()
  }

  // Store data for floating ball
  floatingBallData = { ...data, type: "warning" }

  // Create warning container
  const container = document.createElement("div")
  container.id = "kongjun-warning"
  document.body.appendChild(container)

  // Browser-native warning bar style
  container.innerHTML = `
    <div style="
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      background: #fce8e6;
      border-bottom: 1px solid #d93025;
      z-index: 999998;
      padding: 12px 16px;
      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      transition: opacity 0.3s;
    ">
      <div style="
        max-width: 1200px;
        margin: 0 auto;
        display: flex;
        align-items: center;
        gap: 16px;
      ">
        <!-- Warning Icon -->
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#d93025" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="flex-shrink: 0;">
          <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path>
          <line x1="12" y1="9" x2="12" y2="13"></line>
          <line x1="12" y1="17" x2="12.01" y2="17"></line>
        </svg>

        <!-- Warning Message -->
        <div style="flex: 1; font-size: 13px; color: #5f6368; line-height: 1.5;">
          <strong style="color: #202124;">安全提示：</strong>
          该网站可能并非 <span style="color: #1a73e8; font-weight: 500;">${data.softwareName}</span> 官方站点
          <span style="color: #d93025; font-weight: 500;">（${data.reason}）</span>
        </div>

        <!-- Go to Official Site Button -->
        <a
          href="${data.officialUrl}"
          target="_blank"
          rel="noopener noreferrer"
          style="
            background: #8ab4f8;
            color: #202124;
            padding: 6px 16px;
            border-radius: 4px;
            text-decoration: none;
            font-size: 13px;
            font-weight: 500;
            white-space: nowrap;
            transition: background 0.2s;
          "
          onmouseover="this.style.background='#aecbfa'"
          onmouseout="this.style.background='#8ab4f8'"
        >
          前往官网
        </a>

        <!-- Close Button -->
        <button
          id="kongjun-close-warning"
          style="
            background: transparent;
            border: none;
            width: 28px;
            height: 28px;
            border-radius: 50%;
            color: #5f6368;
            cursor: pointer;
            padding: 0;
            display: flex;
            align-items: center;
            justify-content: center;
            transition: background 0.2s;
          "
          onmouseover="this.style.background='rgba(0,0,0,0.08)'"
          onmouseout="this.style.background='transparent'"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <line x1="18" y1="6" x2="6" y2="18"></line>
            <line x1="6" y1="6" x2="18" y2="18"></line>
          </svg>
        </button>
      </div>
    </div>
  `

  // Push down body content to prevent overlap
  document.body.style.marginTop = "60px"

  // Attach event listener for close button - show floating ball instead of removing
  const closeBtn = container.querySelector('#kongjun-close-warning')
  if (closeBtn) {
    closeBtn.addEventListener('click', () => {
      // Fade out warning
      container.style.opacity = '0'

      setTimeout(() => {
        container.remove()
        document.body.style.marginTop = ''
        // Show floating ball after warning is removed
        showFloatingBall()
      }, 300)
    })
  }
}

// Floating ball that persists on the page
function showFloatingBall() {
  // Remove existing floating ball if present
  const existing = document.getElementById("kongjun-floating-ball")
  if (existing) {
    existing.remove()
  }

  if (!floatingBallData) {
    console.warn("No floating ball data available")
    return
  }

  const data = floatingBallData
  const isDanger = data.type === "danger"

  // Create floating ball container
  const container = document.createElement("div")
  container.id = "kongjun-floating-ball"
  document.body.appendChild(container)

  // Floating ball style
  container.innerHTML = `
    <div id="kongjun-ball-wrapper" style="
      position: fixed;
      bottom: 24px;
      right: 24px;
      z-index: 999997;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    ">
      <!-- Floating Ball -->
      <div id="kongjun-ball" style="
        width: 56px;
        height: 56px;
        border-radius: 50%;
        background: ${isDanger ? '#d93025' : '#f59e0b'};
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
        display: flex;
        align-items: center;
        justify-content: center;
        cursor: pointer;
        transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
        animation: pulse 2s infinite;
      ">
        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path>
          <line x1="12" y1="9" x2="12" y2="13"></line>
          <line x1="12" y1="17" x2="12.01" y2="17"></line>
        </svg>
      </div>

      <!-- Tooltip Panel (hidden by default) -->
      <div id="kongjun-tooltip" style="
        position: absolute;
        bottom: 70px;
        right: 0;
        width: 300px;
        background: white;
        border-radius: 12px;
        box-shadow: 0 8px 24px rgba(0, 0, 0, 0.2);
        padding: 16px;
        opacity: 0;
        visibility: hidden;
        transform: translateY(10px);
        transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
        border: 2px solid ${isDanger ? '#d93025' : '#f59e0b'};
      ">
        <!-- Header -->
        <div style="
          display: flex;
          align-items: center;
          gap: 8px;
          margin-bottom: 12px;
        ">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="${isDanger ? '#d93025' : '#f59e0b'}" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
            <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path>
            <line x1="12" y1="9" x2="12" y2="13"></line>
            <line x1="12" y1="17" x2="12.01" y2="17"></line>
          </svg>
          <span style="
            font-size: 14px;
            font-weight: 600;
            color: ${isDanger ? '#d93025' : '#f59e0b'};
          ">
            ${isDanger ? '高危网站' : '可疑网站'}
          </span>
        </div>

        <!-- Content -->
        <p style="
          font-size: 13px;
          color: #374151;
          margin: 0 0 12px 0;
          line-height: 1.5;
        ">
          该网站可能伪造 <strong>${data.softwareName}</strong> 官方站点
        </p>

        <p style="
          font-size: 12px;
          color: #6b7280;
          margin: 0 0 16px 0;
          line-height: 1.4;
        ">
          ${data.reason} • 置信度 ${data.confidence}%
        </p>

        <!-- Official Link Button -->
        <a
          href="${data.officialUrl}"
          target="_blank"
          rel="noopener noreferrer"
          style="
            display: block;
            text-align: center;
            background: ${isDanger ? '#d93025' : '#f59e0b'};
            color: white;
            padding: 10px 16px;
            border-radius: 8px;
            text-decoration: none;
            font-size: 13px;
            font-weight: 600;
            transition: all 0.2s;
          "
          onmouseover="this.style.opacity='0.9'"
          onmouseout="this.style.opacity='1'"
        >
          前往官方网站 →
        </a>

        <!-- Dismiss hint -->
        <p style="
          font-size: 11px;
          color: #9ca3af;
          margin: 12px 0 0 0;
          text-align: center;
        ">
          点击悬浮球关闭提示（页面仍有风险）
        </p>
      </div>

      <!-- Pulse Animation -->
      <style>
        @keyframes pulse {
          0%, 100% {
            transform: scale(1);
            box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
          }
          50% {
            transform: scale(1.05);
            box-shadow: 0 6px 20px ${isDanger ? 'rgba(217, 48, 37, 0.4)' : 'rgba(245, 158, 11, 0.4)'};
          }
        }

        #kongjun-ball:hover {
          animation: none;
          transform: scale(1.1);
        }
      </style>
    </div>
  `

  const wrapper = container.querySelector('#kongjun-ball-wrapper')
  const ball = container.querySelector('#kongjun-ball')
  const tooltip = container.querySelector('#kongjun-tooltip')
  let isTooltipVisible = false

  // Toggle tooltip on ball click
  if (ball) {
    ball.addEventListener('click', (e) => {
      e.stopPropagation()
      isTooltipVisible = !isTooltipVisible

      if (isTooltipVisible) {
        tooltip.style.opacity = '1'
        tooltip.style.visibility = 'visible'
        tooltip.style.transform = 'translateY(0)'
      } else {
        tooltip.style.opacity = '0'
        tooltip.style.visibility = 'hidden'
        tooltip.style.transform = 'translateY(10px)'
      }
    })
  }

  // Close tooltip when clicking outside
  document.addEventListener('click', (e) => {
    if (isTooltipVisible && wrapper && !wrapper.contains(e.target as Node)) {
      isTooltipVisible = false
      if (tooltip) {
        tooltip.style.opacity = '0'
        tooltip.style.visibility = 'hidden'
        tooltip.style.transform = 'translateY(10px)'
      }
    }
  })

  // Prevent deletion - recreate if removed
  const observer = new MutationObserver((mutations) => {
    mutations.forEach((mutation) => {
      if (mutation.type === 'childList') {
        const removedNodes = Array.from(mutation.removedNodes)
        if (removedNodes.some((node) => (node as Element).id === 'kongjun-floating-ball')) {
          console.log('悬浮球被删除，立即重新创建')
          showFloatingBall()
        }
      }
    })
  })

  observer.observe(document.body, {
    childList: true,
    subtree: true
  })

  console.log('悬浮球已创建，持续提示用户风险')
}
