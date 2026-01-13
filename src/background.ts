import { analyzePageSecurity } from "./services/securityEngine"
import { incrementStats } from "./utils/cache"
import { PhishingAnalysisResult } from "./types"

console.log("空军反钓鱼扩展已启动")

// Initialize extension on install
chrome.runtime.onInstalled.addListener(async () => {
  console.log("空军 Extension 已安装")

  // Initialize storage with default values
  const storage = await chrome.storage.local.get()
  if (!storage.stats) {
    await chrome.storage.local.set({
      stats: {
        totalScans: 0,
        phishingBlocked: 0,
        warningShown: 0,
        officialVerified: 0
      }
    })
  }

  if (!storage.blacklist) {
    await chrome.storage.local.set({
      blacklist: []
    })
  }

  if (!storage.settings) {
    await chrome.storage.local.set({
      settings: {
        enableAI: true,
        warningThreshold: 60,
        blockThreshold: 90,
        cacheExpiry: 86400000 // 24 hours
      }
    })
  }
})

// Listen for page navigation events
chrome.webNavigation.onCompleted.addListener(
  async (details) => {
    // Only analyze main frame (not iframes)
    if (details.frameId !== 0) return

    // Only analyze http/https pages
    if (!details.url.startsWith("http")) return

    console.log("页面加载完成:", details.url)

    // Perform security analysis (async, doesn't block page load)
    analyzePage(details.tabId, details.url)
  }
)

// Analyze page security
async function analyzePage(tabId: number, url: string) {
  console.log("\n" + "=".repeat(60))
  console.log("🔍 [页面分析] 开始分析页面")
  console.log("📍 [页面分析] URL:", url)
  console.log("🆔 [页面分析] Tab ID:", tabId)

  try {
    // Increment total scans
    await incrementStats("totalScans")
    console.log("📊 [页面分析] 统计: totalScans +1")

    // Get DOM content from content script
    console.log("📄 [页面分析] 正在提取 DOM 内容...")
    const response = await chrome.tabs.sendMessage(tabId, {
      action: "extract_dom"
    })

    if (!response || !response.success) {
      console.error("❌ [页面分析] DOM 提取失败:", response?.error)
      return
    }

    console.log("✅ [页面分析] DOM 提取成功")
    console.log("📝 [页面分析] 页面标题:", response.domContent?.title)
    console.log("📝 [页面分析] 页面描述:", response.domContent?.metaDescription?.substring(0, 100))

    // Perform three-layer analysis
    console.log("\n⚙️ [页面分析] 开始三层过滤分析...")
    const result = await analyzePageSecurity(
      url,
      response.domContent,
      response.domContent?.title
    )

    console.log("\n" + "─".repeat(60))
    console.log("📊 [分析结果] ==================")
    console.log("📊 [分析结果] 是否钓鱼:", result.isPhishing ? "⚠️ 是" : "✅ 否")
    console.log("📊 [分析结果] 置信度:", result.confidence + "%")
    console.log("📊 [分析结果] 判定依据:", result.reason)
    console.log("📊 [分析结果] 分析层级:", result.layer)
    if (result.matchedSoftware) {
      console.log("📊 [分析结果] 识别软件:", result.matchedSoftware.name)
    }
    console.log("─".repeat(60) + "\n")

    // Update stats based on result
    if (result.isPhishing) {
      const settings = await chrome.storage.local.get("settings")
      const blockThreshold = settings.settings?.blockThreshold || 90
      const warningThreshold = settings.settings?.warningThreshold || 60

      console.log("🚨 [防护措施] 检测到钓鱼网站")
      console.log("🚨 [防护措施] 当前置信度:", result.confidence + "%")
      console.log("🚨 [防护措施] 拦截阈值:", blockThreshold + "%")
      console.log("🚨 [防护措施] 警告阈值:", warningThreshold + "%")

      if (result.confidence >= blockThreshold) {
        await incrementStats("phishingBlocked")
        console.log("🛑 [防护措施] 触发红色全屏覆盖 (90%+)")
        console.log("🛑 [防护措施] matchedSoftware:", result.matchedSoftware)
        // Inject red overlay
        const officialUrl = result.matchedSoftware?.officialDomains[0]
          ? `https://${result.matchedSoftware.officialDomains[0]}`
          : "#"

        chrome.tabs.sendMessage(tabId, {
          action: "inject_overlay",
          data: {
            softwareName: result.matchedSoftware?.name || "未知软件",
            officialUrl,
            reason: result.reason,
            confidence: result.confidence
          }
        })
      } else if (result.confidence >= warningThreshold) {
        await incrementStats("warningShown")
        console.log("⚠️ [防护措施] 触发黄色警告栏 (60-90%)")
        console.log("⚠️ [防护措施] matchedSoftware:", result.matchedSoftware)
        // Inject yellow warning bar
        const officialUrl = result.matchedSoftware?.officialDomains[0]
          ? `https://${result.matchedSoftware.officialDomains[0]}`
          : "#"

        chrome.tabs.sendMessage(tabId, {
          action: "inject_warning",
          data: {
            softwareName: result.matchedSoftware?.name || "未知软件",
            officialUrl,
            reason: result.reason,
            confidence: result.confidence
          }
        })
      } else {
        console.log("✅ [防护措施] 置信度低于警告阈值，不显示警告")
      }
    } else {
      await incrementStats("officialVerified")
      console.log("✅ [防护措施] 页面安全，已认证")
    }

    // Save result for popup access
    await chrome.storage.local.set({
      [`analysis_${tabId}`]: {
        status: result.isPhishing
          ? result.confidence >= 90
            ? "blocked"
            : "warning"
          : "safe",
        result
      }
    })

    console.log("💾 [存储] 分析结果已保存到 storage")
    console.log("=".repeat(60) + "\n")
  } catch (error) {
    console.error("❌ [页面分析] 分析失败:", error)
  }
}

// Listen for messages from content scripts and popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  console.log("收到消息:", request)

  if (request.action === "get_page_status") {
    // Return saved analysis result for current tab
    if (sender.tab?.id) {
      chrome.storage.local.get(`analysis_${sender.tab.id}`, (data) => {
        const result = data[`analysis_${sender.tab.id}`]
        sendResponse(result || { status: "pending" })
      })
      return true
    }
  }

  if (request.action === "report_phishing") {
    // User reported a phishing site
    chrome.storage.local.get("blacklist", async (data) => {
      const blacklist = data.blacklist || []
      if (!blacklist.includes(request.url)) {
        blacklist.push(request.url)
        await chrome.storage.local.set({ blacklist })
      }
      sendResponse({ success: true })
    })
    return true
  }

  return false
})
