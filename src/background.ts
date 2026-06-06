import { CONFIG } from "./constants/config"
import { OFFICIAL_SOFTWARE_REGISTRY } from "./data/officialRegistry"
import { activateTenant, pullPolicy } from "./services/cloudClient"
import {
  findOfficialUrlByBrand,
  syncOpenDataset
} from "./services/openDataset"
import {
  createSecurityEvent,
  enqueueEvent,
  flushReportingQueue,
  getQueueSize
} from "./services/reporting"
import {
  analyzePageSecurity,
  NEEDS_DOM_REVIEW_REASON} from "./services/securityEngine"
import {
  createDefaultActivation,
  createDefaultOpenDatasetState,
  createDefaultRuntime,
  DEFAULT_POLICY,
  DEFAULT_SETTINGS,
  getEffectivePolicy,
  getOpenDatasetState,
  getRuntimeState,
  getTenantActivation,
  incrementStats,
  setEffectivePolicy,
  setTenantActivation
} from "./utils/cache"

const REPORTING_ALARM = "skunked-reporting-upload"
const POLICY_ALARM = "skunked-policy-sync"
const DATASET_ALARM = "skunked-open-dataset-sync"

function safeHost(url: string): string {
  try {
    return new URL(url).host
  } catch {
    return "unknown"
  }
}

function statusFromVerdict(
  verdict: "allow" | "warn" | "block"
): "safe" | "warning" | "blocked" {
  if (verdict === "block") return "blocked"
  if (verdict === "warn") return "warning"
  return "safe"
}

async function bootstrapStorage() {
  const storage = await chrome.storage.local.get()
  const version = chrome.runtime.getManifest().version

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
    await chrome.storage.local.set({ settings: DEFAULT_SETTINGS })
  }

  if (!storage.runtime?.installationId) {
    await chrome.storage.local.set({
      runtime: createDefaultRuntime(version)
    })
  }

  if (!storage.tenant?.activation) {
    await chrome.storage.local.set({
      tenant: {
        activation: createDefaultActivation()
      }
    })
  }

  if (!storage.policy?.effective) {
    await chrome.storage.local.set({
      policy: {
        effective: DEFAULT_POLICY
      }
    })
  }

  if (!storage.reporting?.queue) {
    await chrome.storage.local.set({
      reporting: {
        queue: []
      }
    })
  }

  if (!storage.openDataset?.apps?.length) {
    await chrome.storage.local.set({
      openDataset: createDefaultOpenDatasetState()
    })
  }
}

async function ensureAlarms() {
  await chrome.alarms.create(REPORTING_ALARM, {
    periodInMinutes: CONFIG.CLOUD_REPORT_UPLOAD_INTERVAL_MINUTES
  })

  await chrome.alarms.create(POLICY_ALARM, {
    periodInMinutes: CONFIG.CLOUD_POLICY_SYNC_INTERVAL_MINUTES
  })

  await chrome.alarms.create(DATASET_ALARM, {
    periodInMinutes: CONFIG.OPEN_DATASET_SYNC_INTERVAL_MINUTES
  })
}

async function syncPolicyFromCloud() {
  try {
    const activation = await getTenantActivation()
    if (!activation.activated || !activation.token) return

    const policy = await pullPolicy()
    await setEffectivePolicy(policy)
  } catch (error) {
    console.warn("policy sync failed", error)
  }
}

async function syncOpenDatasetFromCloud(force = false) {
  try {
    await syncOpenDataset(force)
  } catch (error) {
    console.warn("open dataset sync failed", error)
  }
}

async function reportDecisionEvent(input: {
  url: string
  verdict: "allow" | "warn" | "block"
  confidence: number
  layer: "whitelist" | "blacklist" | "heuristics" | "cloud"
  reason: string
  matchedBrand?: string
  titleDigest?: string
  h1Digest?: string
  datasetVersion?: string
  actionTaken: "auto_blocked" | "shown_warning" | "continued" | "allowed"
}) {
  const [runtime, activation] = await Promise.all([
    getRuntimeState(chrome.runtime.getManifest().version),
    getTenantActivation()
  ])

  await enqueueEvent(
    createSecurityEvent({
      ts: Date.now(),
      eventType:
        input.verdict === "block"
          ? "blocked"
          : input.verdict === "warn"
            ? "warned"
            : "bypassed",
      orgId: activation.orgId,
      installationId: runtime.installationId,
      urlHost: safeHost(input.url),
      riskVerdict: input.verdict,
      confidence: input.confidence,
      layer: input.layer,
      actionTaken: input.actionTaken,
      reason: input.reason,
      matchedBrand: input.matchedBrand,
      titleDigest: input.titleDigest,
      h1Digest: input.h1Digest,
      datasetVersion: input.datasetVersion
    })
  )
}

async function officialUrlByBrand(brand?: string): Promise<string> {
  if (!brand) return "#"

  const fromDataset = await findOfficialUrlByBrand(brand)
  if (fromDataset !== "#") return fromDataset

  const software = OFFICIAL_SOFTWARE_REGISTRY.find(
    (item) => item.name === brand || item.nameEn === brand
  )

  if (software?.officialUrls?.[0]) {
    return software.officialUrls[0]
  }

  return software?.officialDomains?.[0] ? `https://${software.officialDomains[0]}` : "#"
}

async function resolveOfficialUrl(result: {
  matchedSoftware?: { officialUrls?: string[]; officialDomains?: string[] }
  matchedBrand?: string
}): Promise<string> {
  if (result.matchedSoftware?.officialUrls?.[0]) {
    return result.matchedSoftware.officialUrls[0]
  }

  if (result.matchedSoftware?.officialDomains?.[0]) {
    return `https://${result.matchedSoftware.officialDomains[0]}`
  }

  return officialUrlByBrand(result.matchedBrand)
}

async function analyzePage(tabId: number, url: string) {
  try {
    await incrementStats("totalScans")

    const precheckResult = await analyzePageSecurity(url)
    let result = precheckResult
    let domContent: {
      title?: string
      h1Text?: string
    } | undefined

    // Only collect DOM when the URL precheck indicates cloud semantic review is needed.
    if (precheckResult.reason === NEEDS_DOM_REVIEW_REASON) {
      const response = await chrome.tabs.sendMessage(tabId, {
        action: "extract_dom"
      })

      if (!response?.success) return

      domContent = response.domContent
      result = await analyzePageSecurity(url, response.domContent, response.domContent?.title)
    }

    const officialUrl = await resolveOfficialUrl(result)

    if (result.verdict === "block") {
      await incrementStats("phishingBlocked")
      await chrome.tabs.sendMessage(tabId, {
        action: "inject_overlay",
        data: {
          softwareName: result.matchedBrand || "未知软件",
          officialUrl,
          reason: result.reason,
          confidence: result.confidence,
          datasetVersion: result.datasetVersion
        }
      })
    } else if (result.verdict === "warn") {
      await incrementStats("warningShown")
      await chrome.tabs.sendMessage(tabId, {
        action: "inject_warning",
        data: {
          softwareName: result.matchedBrand || "可疑站点",
          officialUrl,
          reason: result.reason,
          confidence: result.confidence,
          datasetVersion: result.datasetVersion
        }
      })
    } else {
      await incrementStats("officialVerified")
    }

    await chrome.storage.local.set({
      [`analysis_${tabId}`]: {
        status: statusFromVerdict(result.verdict),
        result
      }
    })

    await reportDecisionEvent({
      url,
      verdict: result.verdict,
      confidence: result.confidence,
      layer: result.layer,
      reason: result.reason,
      matchedBrand: result.matchedBrand,
      titleDigest: domContent?.title,
      h1Digest: domContent?.h1Text,
      datasetVersion: result.datasetVersion,
      actionTaken:
        result.verdict === "block"
          ? "auto_blocked"
          : result.verdict === "warn"
            ? "shown_warning"
            : "allowed"
    })
  } catch (error) {
    console.error("analyze page failed", error)
  }
}

chrome.runtime.onInstalled.addListener(async () => {
  await bootstrapStorage()
  await ensureAlarms()
  await syncOpenDatasetFromCloud(true)
})

chrome.runtime.onStartup.addListener(async () => {
  await bootstrapStorage()
  await ensureAlarms()
  await syncOpenDatasetFromCloud(true)
})

chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name === REPORTING_ALARM) {
    await flushReportingQueue()
  }
  if (alarm.name === POLICY_ALARM) {
    await syncPolicyFromCloud()
  }
  if (alarm.name === DATASET_ALARM) {
    await syncOpenDatasetFromCloud(true)
  }
})

chrome.webNavigation.onCompleted.addListener(async (details) => {
  if (details.frameId !== 0) return
  if (!details.url.startsWith("http")) return
  analyzePage(details.tabId, details.url)
})

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "get_page_status") {
    const tabId = sender.tab?.id
    if (!tabId) return false

    chrome.storage.local.get(`analysis_${tabId}`, (data) => {
      sendResponse(data[`analysis_${tabId}`] || { status: "pending" })
    })
    return true
  }

  if (request.action === "activate_tenant") {
    ;(async () => {
      try {
        const runtime = await getRuntimeState(chrome.runtime.getManifest().version)
        const activationResult = await activateTenant(
          request.data.activationCode,
          runtime.installationId
        )
        await setTenantActivation(activationResult.activation)
        if (activationResult.policy) {
          await setEffectivePolicy(activationResult.policy)
        }
        sendResponse({
          success: true,
          data: {
            activated: true,
            orgId: activationResult.activation.orgId,
            policyVersion: activationResult.policy?.policyVersion
          }
        })
      } catch (error) {
        sendResponse({
          success: false,
          error: error instanceof Error ? error.message : "激活失败"
        })
      }
    })()
    return true
  }

  if (request.action === "sync_policy") {
    ;(async () => {
      try {
        await syncPolicyFromCloud()
        const policy = await getEffectivePolicy()
        sendResponse({
          success: true,
          data: {
            activated: true,
            policyVersion: policy.policyVersion
          }
        })
      } catch (error) {
        sendResponse({
          success: false,
          error: error instanceof Error ? error.message : "同步失败"
        })
      }
    })()
    return true
  }

  if (request.action === "sync_open_dataset") {
    ;(async () => {
      try {
        await syncOpenDatasetFromCloud(true)
        const openDataset = await getOpenDatasetState()
        sendResponse({
          success: true,
          data: {
            activated: true,
            datasetVersion: openDataset.datasetVersion
          }
        })
      } catch (error) {
        sendResponse({
          success: false,
          error: error instanceof Error ? error.message : "数据集同步失败"
        })
      }
    })()
    return true
  }

  if (request.action === "flush_reporting") {
    ;(async () => {
      try {
        const result = await flushReportingQueue()
        sendResponse({
          success: true,
          data: {
            activated: true,
            queueSize: result.remaining
          }
        })
      } catch (error) {
        sendResponse({
          success: false,
          error: error instanceof Error ? error.message : "上报失败"
        })
      }
    })()
    return true
  }

  if (request.action === "get_runtime_info") {
    ;(async () => {
      const [activation, policy, queueSize, openDataset] = await Promise.all([
        getTenantActivation(),
        getEffectivePolicy(),
        getQueueSize(),
        getOpenDatasetState()
      ])

      sendResponse({
        success: true,
        data: {
          activated: activation.activated,
          orgId: activation.orgId,
          policyVersion: policy.policyVersion,
          queueSize,
          datasetVersion: openDataset.datasetVersion
        }
      })
    })()
    return true
  }

  if (request.action === "report_false_positive") {
    ;(async () => {
      const runtime = await getRuntimeState(chrome.runtime.getManifest().version)
      const [activation, openDataset] = await Promise.all([
        getTenantActivation(),
        getOpenDatasetState()
      ])
      await enqueueEvent(
        createSecurityEvent({
          ts: Date.now(),
          eventType: "false_positive_feedback",
          orgId: activation.orgId,
          installationId: runtime.installationId,
          urlHost: safeHost(request.data.url),
          riskVerdict: "warn",
          confidence: 0,
          layer: "heuristics",
          actionTaken: "continued",
          reason: request.data.reason || "用户上报误报",
          datasetVersion: openDataset.datasetVersion
        })
      )
      sendResponse({ success: true })
    })()
    return true
  }

  if (request.action === "risk_bypassed") {
    ;(async () => {
      const runtime = await getRuntimeState(chrome.runtime.getManifest().version)
      const activation = await getTenantActivation()
      const currentUrl = sender.tab?.url || ""
      await enqueueEvent(
        createSecurityEvent({
          ts: Date.now(),
          eventType: "bypassed",
          orgId: activation.orgId,
          installationId: runtime.installationId,
          urlHost: safeHost(currentUrl),
          riskVerdict: "warn",
          confidence: Number(request.data?.confidence || 0),
          layer: "cloud",
          actionTaken: "continued",
          reason: request.data?.reason || "用户继续访问风险页面",
          matchedBrand: request.data?.softwareName,
          datasetVersion: request.data?.datasetVersion
        })
      )
      sendResponse({ success: true })
    })()
    return true
  }

  return false
})
