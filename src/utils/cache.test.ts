import { afterEach, describe, expect, it } from "vitest"

import type { PhishingAnalysisResult } from "../types"
import {
  clearCache,
  createDefaultOpenDatasetState,
  createDefaultRuntime,
  getCacheKey,
  getEffectivePolicy,
  getFromCache,
  getSettings,
  saveToCache
} from "./cache"

const sampleResult = (): PhishingAnalysisResult => ({
  verdict: "warn",
  confidence: 70,
  reason: "test cache",
  layer: "heuristics",
  timestamp: Date.now(),
  source: "local"
})

describe("cache", () => {
  afterEach(async () => {
    await clearCache()
  })

  it("builds stable cache keys for same host and path prefix", () => {
    expect(getCacheKey("https://feishu.cn/a/b/c")).toBe(
      getCacheKey("https://feishu.cn/a/b/d")
    )
    expect(getCacheKey("https://feishu.cn/")).toBe("feishu.cn/")
  })

  it("creates default runtime and dataset state", () => {
    const runtime = createDefaultRuntime("1.0.0")
    expect(runtime.installationId).toBeTruthy()
    expect(runtime.lastVersion).toBe("1.0.0")

    const dataset = createDefaultOpenDatasetState()
    expect(dataset.apps.length).toBeGreaterThan(0)
    expect(dataset.phishingConfirmed).toEqual([])
  })

  it("round-trips analysis results through chrome storage", async () => {
    const url = "https://example.com/page"
    const result = sampleResult()

    await saveToCache(url, result)
    const cached = await getFromCache(url)

    expect(cached?.result.reason).toBe("test cache")
    expect(cached?.cacheKey).toBe(getCacheKey(url))
    expect(cached?.expiresAt).toBeGreaterThan(Date.now())
  })

  it("removes expired cache entries on read", async () => {
    const url = "https://expired.example/"
    const key = getCacheKey(url)
    const storageKey = `analysis_cache_${btoa(key)}`

    await chrome.storage.local.set({
      [storageKey]: JSON.stringify({
        cacheKey: key,
        result: sampleResult(),
        expiresAt: Date.now() - 1000
      })
    })

    const cached = await getFromCache(url)
    expect(cached).toBeNull()

    const storage = await chrome.storage.local.get(storageKey)
    expect(storage[storageKey]).toBeUndefined()
  })

  it("clears all analysis cache keys", async () => {
    await saveToCache("https://one.example/", sampleResult())
    await saveToCache("https://two.example/", sampleResult())

    await clearCache()

    expect(await getFromCache("https://one.example/")).toBeNull()
    expect(await getFromCache("https://two.example/")).toBeNull()
  })

  it("uses persisted settings for cache expiry", async () => {
    await chrome.storage.local.set({
      settings: {
        warningThreshold: 60,
        blockThreshold: 90,
        cacheExpiry: 5000
      }
    })

    await saveToCache("https://settings.example/", sampleResult())
    const cached = await getFromCache("https://settings.example/")

    expect(cached?.expiresAt).toBeLessThanOrEqual(Date.now() + 5000)
  })

  it("falls back to default settings when storage is empty", async () => {
    const settings = await getSettings()
    expect(settings.cacheExpiry).toBeGreaterThan(0)
  })

  it("uses page signals in the default local policy", async () => {
    const policy = await getEffectivePolicy()
    expect(policy.brandSignalMode).toBe("page_signals")
  })
})
