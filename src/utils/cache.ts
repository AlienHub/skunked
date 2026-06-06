import { CONFIG } from "../constants/config"
import { OFFICIAL_SOFTWARE_REGISTRY } from "../data/officialRegistry"
import {
  AnalysisCache,
  EffectivePolicy,
  ExtensionStorage,
  OpenDatasetState,
  PhishingAnalysisResult,
  RuntimeState,
  TenantActivation
} from "../types"
import { extractDomain } from "./domainMatcher"

const CACHE_KEY_PREFIX = "analysis_cache_"

export const DEFAULT_SETTINGS: ExtensionStorage["settings"] = {
  warningThreshold: CONFIG.WARNING_THRESHOLD,
  blockThreshold: CONFIG.BLOCK_THRESHOLD,
  cacheExpiry: CONFIG.CACHE_EXPIRY_MS
}

export const DEFAULT_POLICY: EffectivePolicy = {
  warningThreshold: CONFIG.WARNING_THRESHOLD,
  blockThreshold: CONFIG.BLOCK_THRESHOLD,
  mode: "balanced",
  brandSignalMode: "url_only",
  policyVersion: "local-default",
  updatedAt: Date.now()
}

export function createDefaultRuntime(version: string): RuntimeState {
  const installationId =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(16).slice(2)}`

  return {
    installationId,
    firstInstalledAt: Date.now(),
    lastVersion: version
  }
}

export function createDefaultActivation(): TenantActivation {
  return {
    activated: false
  }
}

export function createDefaultOpenDatasetState(): OpenDatasetState {
  return {
    datasetVersion: "fallback-local-v1",
    updatedAt: Date.now(),
    lastSyncedAt: 0,
    apps: OFFICIAL_SOFTWARE_REGISTRY.map((item) => ({
      ...item,
      officialDomains: [...item.officialDomains],
      officialUrls: [...item.officialUrls],
      keywords: [...item.keywords]
    })),
    phishingConfirmed: []
  }
}

export function getCacheKey(url: string): string {
  try {
    const parsed = new URL(url)
    const normalizedPath = parsed.pathname === "/" ? "/" : parsed.pathname.replace(/\/+$/, "")
    const pathPart = normalizedPath.split("/").slice(0, 2).join("/") || "/"
    return `${extractDomain(url)}${pathPart}`
  } catch {
    return url
  }
}

async function setCacheItem(cacheKey: string, data: AnalysisCache) {
  await chrome.storage.local.set({
    [`${CACHE_KEY_PREFIX}${btoa(cacheKey)}`]: JSON.stringify(data)
  })
}

/**
 * Get cached analysis result for URL
 */
export async function getFromCache(url: string): Promise<AnalysisCache | null> {
  const normalizedKey = getCacheKey(url)
  const cacheKey = `${CACHE_KEY_PREFIX}${btoa(normalizedKey)}`
  const storage = await chrome.storage.local.get(cacheKey)

  if (storage[cacheKey]) {
    const cached: AnalysisCache = JSON.parse(storage[cacheKey])

    // Check if expired
    if (cached.expiresAt > Date.now()) {
      return cached
    } else {
      // Remove expired entry
      await chrome.storage.local.remove(cacheKey)
    }
  }

  return null
}

/**
 * Save analysis result to cache
 */
export async function saveToCache(
  url: string,
  result: PhishingAnalysisResult
): Promise<void> {
  const settings = await getSettings()
  const normalizedKey = getCacheKey(url)

  const cached: AnalysisCache = {
    cacheKey: normalizedKey,
    result,
    expiresAt: Date.now() + settings.cacheExpiry
  }

  await setCacheItem(normalizedKey, cached)
}

/**
 * Clear all cached results
 */
export async function clearCache(): Promise<void> {
  const storage = await chrome.storage.local.get()
  const keysToRemove = Object.keys(storage).filter((key) =>
    key.startsWith(CACHE_KEY_PREFIX)
  )

  if (keysToRemove.length > 0) {
    await chrome.storage.local.remove(keysToRemove)
  }
}

/**
 * Increment stats counter
 */
export async function incrementStats(
  field: keyof ExtensionStorage["stats"]
): Promise<void> {
  const storage = await chrome.storage.local.get("stats")
  const stats = storage.stats || {
    totalScans: 0,
    phishingBlocked: 0,
    warningShown: 0,
    officialVerified: 0
  }

  stats[field]++
  await chrome.storage.local.set({ stats })
}

/**
 * Get blacklist from storage
 */
export async function getBlacklist(): Promise<string[]> {
  const storage = await chrome.storage.local.get("blacklist")
  return storage.blacklist || []
}

/**
 * Add domain to blacklist
 */
export async function addToBlacklist(domain: string): Promise<void> {
  const blacklist = await getBlacklist()
  if (!blacklist.includes(domain)) {
    blacklist.push(domain)
    await chrome.storage.local.set({ blacklist })
  }
}

/**
 * Get settings from storage
 */
export async function getSettings(): Promise<ExtensionStorage["settings"]> {
  const storage = await chrome.storage.local.get("settings")
  return storage.settings || DEFAULT_SETTINGS
}

export async function getRuntimeState(version: string): Promise<RuntimeState> {
  const storage = await chrome.storage.local.get("runtime")
  if (!storage.runtime?.installationId) {
    const runtime = createDefaultRuntime(version)
    await chrome.storage.local.set({ runtime })
    return runtime
  }
  return storage.runtime
}

export async function getTenantActivation(): Promise<TenantActivation> {
  const storage = await chrome.storage.local.get("tenant")
  return storage.tenant?.activation || createDefaultActivation()
}

export async function setTenantActivation(activation: TenantActivation): Promise<void> {
  const storage = await chrome.storage.local.get("tenant")
  await chrome.storage.local.set({
    tenant: {
      ...(storage.tenant || {}),
      activation
    }
  })
}

export function normalizeEffectivePolicy(
  policy: Partial<EffectivePolicy> | undefined
): EffectivePolicy {
  return {
    ...DEFAULT_POLICY,
    ...policy,
    brandSignalMode: policy?.brandSignalMode ?? DEFAULT_POLICY.brandSignalMode
  }
}

export async function getEffectivePolicy(): Promise<EffectivePolicy> {
  const storage = await chrome.storage.local.get(["policy", "settings"])
  if (storage.policy?.effective) {
    return normalizeEffectivePolicy(storage.policy.effective)
  }

  const settings = storage.settings || DEFAULT_SETTINGS
  return normalizeEffectivePolicy({
    warningThreshold: settings.warningThreshold,
    blockThreshold: settings.blockThreshold,
    mode: "balanced",
    policyVersion: "local-settings",
    updatedAt: Date.now()
  })
}

export async function setEffectivePolicy(policy: EffectivePolicy): Promise<void> {
  const storage = await chrome.storage.local.get("policy")
  await chrome.storage.local.set({
    policy: {
      ...(storage.policy || {}),
      effective: normalizeEffectivePolicy(policy)
    }
  })
}

export async function getOpenDatasetState(): Promise<OpenDatasetState> {
  const storage = await chrome.storage.local.get("openDataset")
  if (storage.openDataset?.apps?.length) {
    return storage.openDataset as OpenDatasetState
  }

  return createDefaultOpenDatasetState()
}

export async function setOpenDatasetState(state: OpenDatasetState): Promise<void> {
  await chrome.storage.local.set({ openDataset: state })
}
