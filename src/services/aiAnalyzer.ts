import { AnalyzeRequestPayload, RiskDecision } from "../types"
import { analyzeWithCloud } from "./cloudClient"

interface LocalModelConfig {
  enabled: boolean
  apiKey: string
  baseUrl: string
  modelId: string
}

const DEFAULT_LOCAL_MODEL_CONFIG: LocalModelConfig = {
  enabled: false,
  apiKey: "",
  baseUrl: "https://api.deepseek.com/v1",
  modelId: "deepseek-chat"
}

function normalizeBaseUrl(baseUrl: string): string {
  return baseUrl.trim().replace(/\/$/, "")
}

function stripCodeFence(value: string): string {
  return value
    .trim()
    .replace(/^```(?:json)?/i, "")
    .replace(/```$/, "")
    .trim()
}

function parseBoolean(value: unknown): boolean {
  if (typeof value === "boolean") return value
  if (typeof value === "string") return value.toLowerCase() === "true"
  return Boolean(value)
}

function normalizeDecision(payload: any): RiskDecision {
  if (payload?.verdict) {
    return {
      verdict: payload.verdict,
      confidence: Number(payload.confidence) || 0,
      reason: String(payload.reason || "模型未返回理由"),
      matchedBrand: payload.matchedBrand,
      modelTraceId: payload.modelTraceId
    }
  }

  const isPhishing = parseBoolean(payload?.isPhishing ?? payload?.is_phishing)
  const confidence = Number(payload?.confidence) || 0

  return {
    verdict: isPhishing ? (confidence >= 90 ? "block" : "warn") : "allow",
    confidence,
    reason: String(payload?.reason || "模型未返回理由"),
    matchedBrand: payload?.matchedBrand
  }
}

function buildLocalPrompt(payload: AnalyzeRequestPayload): string {
  return `你是一个反钓鱼网页识别助手。请判断当前页面是否在冒充受保护软件官网、诱导下载恶意软件或误导用户访问假入口。

当前 URL：${payload.url}
Host：${payload.host}
Path：${payload.path}
页面标题：${payload.title || "无"}
H1：${payload.h1Text || "无"}
按钮文案：${payload.buttonTexts.join("、") || "无"}
下载相关词：${payload.downloadKeywords.join("、") || "无"}
品牌线索：${payload.brandHint || "未知"}
触发来源：${payload.layerHint}

只输出 JSON，不要输出解释文本。格式：
{
  "verdict": "allow" | "warn" | "block",
  "confidence": 0-100,
  "reason": "一句中文理由",
  "matchedBrand": "品牌名或空"
}

判定要求：
- 明确冒充官方软件下载页、非官方域名承载品牌下载入口时，返回 block。
- 只有弱线索但无法确认时，返回 warn。
- 普通内容页、搜索页、无软件下载意图时，返回 allow。`
}

async function getLocalModelConfig(): Promise<LocalModelConfig> {
  const storage = await chrome.storage.local.get([
    "localModelConfig",
    "openaiApiKey",
    "baseUrl",
    "modelId"
  ])

  const stored = storage.localModelConfig || {}
  return {
    ...DEFAULT_LOCAL_MODEL_CONFIG,
    ...stored,
    apiKey: String(stored.apiKey || storage.openaiApiKey || ""),
    baseUrl: String(
      stored.baseUrl || storage.baseUrl || DEFAULT_LOCAL_MODEL_CONFIG.baseUrl
    ),
    modelId: String(
      stored.modelId || storage.modelId || DEFAULT_LOCAL_MODEL_CONFIG.modelId
    )
  }
}

export async function hasLocalModelConfig(): Promise<boolean> {
  const config = await getLocalModelConfig()
  return Boolean(config.enabled && config.apiKey.trim())
}

async function analyzeWithLocalModel(
  payload: AnalyzeRequestPayload
): Promise<RiskDecision> {
  const config = await getLocalModelConfig()
  if (!config.enabled || !config.apiKey.trim()) {
    throw new Error("本地大模型配置未启用")
  }

  const response = await fetch(
    `${normalizeBaseUrl(config.baseUrl)}/chat/completions`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${config.apiKey.trim()}`
      },
      body: JSON.stringify({
        model: config.modelId.trim(),
        messages: [
          {
            role: "system",
            content: "你是网络安全专家，只返回符合要求的 JSON。"
          },
          {
            role: "user",
            content: buildLocalPrompt(payload)
          }
        ],
        temperature: 0.1,
        max_tokens: 500
      })
    }
  )

  if (!response.ok) {
    throw new Error(`本地大模型调用失败：HTTP ${response.status}`)
  }

  const data = await response.json()
  const content = data?.choices?.[0]?.message?.content
  if (!content) {
    throw new Error("本地大模型未返回内容")
  }

  return normalizeDecision(JSON.parse(stripCodeFence(String(content))))
}

export async function analyzeWithAI(
  payload: AnalyzeRequestPayload
): Promise<RiskDecision> {
  if (await hasLocalModelConfig()) {
    return analyzeWithLocalModel(payload)
  }

  return analyzeWithCloud(payload)
}
