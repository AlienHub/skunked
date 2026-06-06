import { analyzePageSecurity } from "./services/securityEngine"
import { ExtractedDOMContent, PhishingAnalysisResult } from "./types"
import { getSettings, incrementStats } from "./utils/cache"

async function bootstrapStorage() {
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
    await chrome.storage.local.set({ blacklist: [] })
  }

  if (!storage.settings) {
    await chrome.storage.local.set({
      settings: {
        enableAI: false,
        warningThreshold: 60,
        blockThreshold: 90,
        cacheExpiry: 86400000
      }
    })
  }
}

function statusFromResult(
  result: PhishingAnalysisResult,
  blockThreshold: number
): "safe" | "warning" | "blocked" {
  if (!result.isPhishing) return "safe"
  return result.confidence >= blockThreshold ? "blocked" : "warning"
}

function needsDomReview(result: PhishingAnalysisResult): boolean {
  return (
    !result.isPhishing &&
    result.layer === "heuristics" &&
    result.reason.includes("需AI分析")
  )
}

function officialUrlFor(result: PhishingAnalysisResult): string {
  const officialDomain = result.matchedSoftware?.officialDomains?.[0]
  return officialDomain ? `https://${officialDomain}` : "#"
}

async function persistResult(tabId: number, result: PhishingAnalysisResult) {
  const settings = await getSettings()

  await incrementStats("totalScans")

  if (result.isPhishing && result.confidence >= settings.blockThreshold) {
    await incrementStats("phishingBlocked")
  } else if (
    result.isPhishing &&
    result.confidence >= settings.warningThreshold
  ) {
    await incrementStats("warningShown")
  } else if (!result.isPhishing && result.layer === "whitelist") {
    await incrementStats("officialVerified")
  }

  await chrome.storage.local.set({
    [`analysis_${tabId}`]: {
      status: statusFromResult(result, settings.blockThreshold),
      result
    }
  })
}

async function createUiDecision(result: PhishingAnalysisResult) {
  if (!result.isPhishing) return null

  const settings = await getSettings()
  if (result.confidence < settings.warningThreshold) return null

  return {
    action:
      result.confidence >= settings.blockThreshold
        ? "inject_overlay"
        : "inject_warning",
    data: {
      softwareName: result.matchedSoftware?.name || "可疑站点",
      officialUrl: officialUrlFor(result),
      reason: result.reason,
      confidence: result.confidence
    }
  }
}

async function analyzeFast(tabId: number, url: string) {
  const result = await analyzePageSecurity(url)

  if (needsDomReview(result)) {
    return {
      needsDom: true,
      ui: null
    }
  }

  await persistResult(tabId, result)
  return {
    needsDom: false,
    ui: await createUiDecision(result)
  }
}

async function analyzeDom(
  tabId: number,
  url: string,
  domContent: ExtractedDOMContent
) {
  const result = await analyzePageSecurity(url, domContent, domContent.title)
  await persistResult(tabId, result)

  return {
    needsDom: false,
    ui: await createUiDecision(result)
  }
}

chrome.runtime.onInstalled.addListener(async () => {
  await bootstrapStorage()
})

chrome.runtime.onStartup.addListener(async () => {
  await bootstrapStorage()
})

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "analyze_url_fast") {
    ;(async () => {
      const tabId = sender.tab?.id
      const url = request.url || sender.tab?.url
      if (!tabId || !url?.startsWith("http")) {
        sendResponse({ success: false, error: "无可分析页面" })
        return
      }

      await bootstrapStorage()
      sendResponse({ success: true, data: await analyzeFast(tabId, url) })
    })()
    return true
  }

  if (request.action === "analyze_dom") {
    ;(async () => {
      const tabId = sender.tab?.id
      const url = request.url || sender.tab?.url
      if (!tabId || !url?.startsWith("http") || !request.domContent) {
        sendResponse({ success: false, error: "缺少页面内容" })
        return
      }

      await bootstrapStorage()
      sendResponse({
        success: true,
        data: await analyzeDom(tabId, url, request.domContent)
      })
    })()
    return true
  }

  if (request.action === "get_runtime_info") {
    sendResponse({
      success: true,
      data: {
        datasetVersion: "local-registry"
      }
    })
    return true
  }

  if (request.action === "sync_open_dataset") {
    sendResponse({
      success: true,
      data: {
        datasetVersion: "local-registry"
      }
    })
    return true
  }

  if (request.action === "get_page_status") {
    const tabId = sender.tab?.id
    if (!tabId) return false

    chrome.storage.local.get(`analysis_${tabId}`, (data) => {
      sendResponse(data[`analysis_${tabId}`] || { status: "pending" })
    })
    return true
  }

  if (request.action === "risk_bypassed") {
    sendResponse({ success: true })
    return true
  }

  if (request.action === "report_phishing") {
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
