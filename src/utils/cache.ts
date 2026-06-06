import {
  AnalysisCache,
  PhishingAnalysisResult,
  ExtensionStorage
} from "../types"

const CACHE_KEY_PREFIX = "analysis_cache_"

/**
 * Get cached analysis result for URL
 */
export async function getFromCache(url: string): Promise<AnalysisCache | null> {
  const cacheKey = `${CACHE_KEY_PREFIX}${btoa(url)}`
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
  const storage = await chrome.storage.local.get("settings")
  const settings = storage.settings || {
    cacheExpiry: 86400000 // 24 hours default
  }

  const cacheKey = `${CACHE_KEY_PREFIX}${btoa(url)}`
  const cached: AnalysisCache = {
    url,
    result,
    expiresAt: Date.now() + settings.cacheExpiry
  }

  await chrome.storage.local.set({
    [cacheKey]: JSON.stringify(cached)
  })
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
  return (
    storage.settings || {
      enableAI: false,
      warningThreshold: 60,
      blockThreshold: 90,
      cacheExpiry: 86400000
    }
  )
}
