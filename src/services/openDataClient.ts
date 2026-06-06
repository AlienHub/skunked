import { CONFIG } from "../constants/config"
import {
  OfficialSoftware,
  OpenDatasetPhishingDomain
} from "../types"

type OpenManifestPayload = {
  version: string
  generatedAt?: string | null
  counts?: {
    apps: number
    officialDomains: number
    phishingConfirmed: number
  }
  sha256?: string
}

type OpenAppsPayload = {
  version: string
  generatedAt?: string | null
  items: OfficialSoftware[]
}

type OpenPhishingPayload = {
  version: string
  generatedAt?: string | null
  items: OpenDatasetPhishingDomain[]
  pagination?: {
    page: number
    pageSize: number
    total: number
    totalPages: number
  }
}

function getOpenDataBaseUrl(): string {
  return CONFIG.OPEN_DATA_API_BASE_URL.replace(/\/$/, "")
}

function toErrorMessage(
  error: unknown,
  context: { url: string; timeoutMs: number }
): string {
  if (error instanceof DOMException && error.name === "AbortError") {
    return `公开数据请求超时（${context.timeoutMs}ms）：${context.url}`
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
  timeoutMs = 8000
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

export async function fetchOpenManifest(): Promise<OpenManifestPayload> {
  const response = await requestWithTimeout(
    `${getOpenDataBaseUrl()}/v1/open/manifest`,
    {
      method: "GET"
    }
  )

  if (!response.ok) {
    const message = await readErrorBody(response)
    throw new Error(`获取公开数据集版本失败：${message}`)
  }

  return response.json()
}

export async function fetchOpenApps(): Promise<OpenAppsPayload> {
  const response = await requestWithTimeout(
    `${getOpenDataBaseUrl()}/v1/open/apps`,
    {
      method: "GET"
    }
  )

  if (!response.ok) {
    const message = await readErrorBody(response)
    throw new Error(`获取公开应用库失败：${message}`)
  }

  return response.json()
}

export async function fetchOpenPhishing(
  params: { status?: "confirmed"; page?: number; pageSize?: number } = {}
): Promise<OpenPhishingPayload> {
  const url = new URL(`${getOpenDataBaseUrl()}/v1/open/phishing`)
  url.searchParams.set("status", params.status || "confirmed")
  if (params.page) url.searchParams.set("page", String(params.page))
  if (params.pageSize) url.searchParams.set("pageSize", String(params.pageSize))

  const response = await requestWithTimeout(url.toString(), {
    method: "GET"
  })

  if (!response.ok) {
    const message = await readErrorBody(response)
    throw new Error(`获取公开钓鱼域名失败：${message}`)
  }

  return response.json()
}
