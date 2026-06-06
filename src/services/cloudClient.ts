import { CONFIG } from "../constants/config"
import {
  AnalyzeRequestPayload,
  EffectivePolicy,
  LegacyAIAnalysisResponse,
  ReportingEvent,
  RiskDecision
} from "../types"

function getCloudBaseUrl(endpoint?: string): string {
  return (endpoint || CONFIG.CLOUD_API_BASE_URL).replace(/\/$/, "")
}

function toErrorMessage(error: unknown, context: { url: string; timeoutMs: number }): string {
  if (error instanceof DOMException && error.name === "AbortError") {
    return `云端请求超时（${context.timeoutMs}ms）：${context.url}`
  }
  if (error instanceof Error) {
    return error.message
  }
  return "未知网络错误"
}

async function readErrorBody(response: Response): Promise<string> {
  const text = await response.text()
  if (!text) return `HTTP ${response.status}`

  try {
    const parsed = JSON.parse(text)
    if (parsed?.error) return String(parsed.error)
    return text
  } catch {
    return text
  }
}

async function requestWithTimeout(
  input: RequestInfo,
  init: RequestInit,
  timeoutMs = CONFIG.CLOUD_ANALYZE_TIMEOUT_MS
): Promise<Response> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort("timeout"), timeoutMs)

  try {
    return await fetch(String(input), {
      ...init,
      signal: controller.signal
    })
  } catch (error) {
    throw new Error(
      toErrorMessage(error, {
        url: String(input),
        timeoutMs
      })
    )
  } finally {
    clearTimeout(timer)
  }
}

function normalizeDecision(payload: any): RiskDecision {
  const raw = payload as LegacyAIAnalysisResponse & {
    verdict?: "allow" | "warn" | "block"
    matchedBrand?: string
    modelTraceId?: string
  }

  if (raw.verdict) {
    return {
      verdict: raw.verdict,
      confidence: Number(raw.confidence) || 0,
      reason: raw.reason || "无判定理由",
      matchedBrand: raw.matchedBrand,
      modelTraceId: raw.modelTraceId
    }
  }

  const isPhishing = raw.isPhishing ?? raw.is_phishing ?? false
  const confidence = Number(raw.confidence) || 0

  return {
    verdict: isPhishing ? (confidence >= 90 ? "block" : "warn") : "allow",
    confidence,
    reason: raw.reason || "模型未返回理由",
    matchedBrand: raw.matchedBrand,
    modelTraceId: raw.modelTraceId
  }
}

async function getTenantAuth() {
  const data = await chrome.storage.local.get("tenant")
  const activation = data.tenant?.activation
  return {
    token: activation?.token as string | undefined,
    endpoint: activation?.endpoint as string | undefined
  }
}

export async function analyzeWithCloud(payload: AnalyzeRequestPayload): Promise<RiskDecision> {
  const auth = await getTenantAuth()
  const response = await requestWithTimeout(
    `${getCloudBaseUrl(auth.endpoint)}/v1/analyze`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(auth.token ? { Authorization: `Bearer ${auth.token}` } : {})
      },
      body: JSON.stringify(payload)
    },
    CONFIG.CLOUD_ANALYZE_TIMEOUT_MS
  )

  if (!response.ok) {
    throw new Error(`cloud analyze failed: ${response.status}`)
  }

  const data = await response.json()
  return normalizeDecision(data)
}

export async function activateTenant(
  activationCode: string,
  installationId: string
): Promise<{
  activation: {
    activated: boolean
    orgId?: string
    token?: string
    endpoint?: string
    activatedAt?: number
    tokenExpiresAt?: number
  }
  policy?: EffectivePolicy
}> {
  const activateUrl = `${getCloudBaseUrl()}/v1/activate`
  const response = await requestWithTimeout(
    activateUrl,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        activationCode,
        installationId
      })
    },
    12000
  )

  if (!response.ok) {
    const message = await readErrorBody(response)
    throw new Error(`激活失败：${message}`)
  }

  return response.json()
}

export async function pullPolicy(): Promise<EffectivePolicy> {
  const auth = await getTenantAuth()
  if (!auth.token) {
    throw new Error("token missing")
  }

  const policyUrl = `${getCloudBaseUrl(auth.endpoint)}/v1/policy`
  const response = await requestWithTimeout(
    policyUrl,
    {
      headers: {
        Authorization: `Bearer ${auth.token}`
      }
    },
    12000
  )

  if (!response.ok) {
    const message = await readErrorBody(response)
    throw new Error(`策略同步失败：${message}`)
  }

  const data = await response.json()
  return data.policy
}

export async function uploadEvents(events: ReportingEvent[]): Promise<{ accepted: number }> {
  const auth = await getTenantAuth()
  const eventsUrl = `${getCloudBaseUrl(auth.endpoint)}/v1/events/batch`
  const response = await requestWithTimeout(
    eventsUrl,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(auth.token ? { Authorization: `Bearer ${auth.token}` } : {})
      },
      body: JSON.stringify({ events })
    },
    12000
  )

  if (!response.ok) {
    const message = await readErrorBody(response)
    throw new Error(`事件上报失败：${message}`)
  }

  return response.json()
}
