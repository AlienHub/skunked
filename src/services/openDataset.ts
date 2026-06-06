import { CONFIG } from "../constants/config"
import {
  OfficialSoftware,
  OpenDatasetPhishingDomain,
  OpenDatasetState
} from "../types"
import {
  createDefaultOpenDatasetState,
  getOpenDatasetState,
  setOpenDatasetState
} from "../utils/cache"
import {
  fetchOpenApps,
  fetchOpenManifest,
  fetchOpenPhishing
} from "./openDataClient"

function parseTimestamp(value?: string | number | null): number {
  if (typeof value === "number") return value
  if (!value) return Date.now()
  const parsed = Date.parse(value)
  return Number.isNaN(parsed) ? Date.now() : parsed
}

function normalizeAppRecord(input: any): OfficialSoftware {
  return {
    id: String(input.id || ""),
    slug: String(input.slug || input.id || ""),
    name: String(input.name || ""),
    nameEn: String(input.nameEn || input.name || ""),
    category: (input.category || "office") as OfficialSoftware["category"],
    officialDomains: Array.isArray(input.officialDomains)
      ? input.officialDomains.map((item: string) => String(item).toLowerCase())
      : [],
    officialUrls: Array.isArray(input.officialUrls)
      ? input.officialUrls.map((item: string) => String(item))
      : [],
    keywords: Array.isArray(input.keywords)
      ? input.keywords.map((item: string) => String(item))
      : []
  }
}

function normalizePhishingRecord(input: any): OpenDatasetPhishingDomain {
  return {
    domain: String(input.domain || "").toLowerCase(),
    targetAppId: input.targetAppId ? String(input.targetAppId).toLowerCase() : undefined,
    status: "confirmed",
    source: String(input.source || "manual_review"),
    firstSeenAt: String(input.firstSeenAt || new Date().toISOString()),
    lastSeenAt: String(input.lastSeenAt || new Date().toISOString()),
    reviewedAt: String(input.reviewedAt || new Date().toISOString()),
    reviewer: String(input.reviewer || "unknown")
  }
}

export async function syncOpenDataset(force = false): Promise<OpenDatasetState> {
  const currentState = await getOpenDatasetState()
  const intervalMs = CONFIG.OPEN_DATASET_SYNC_INTERVAL_MINUTES * 60 * 1000

  if (!force && currentState.lastSyncedAt > 0 && Date.now() - currentState.lastSyncedAt < intervalMs) {
    return currentState
  }

  try {
    const [manifest, apps, firstPhishingPage] = await Promise.all([
      fetchOpenManifest(),
      fetchOpenApps(),
      fetchOpenPhishing({ status: "confirmed", page: 1, pageSize: 100 })
    ])

    const phishingItems = [...(Array.isArray(firstPhishingPage.items) ? firstPhishingPage.items : [])]
    const totalPages = firstPhishingPage.pagination?.totalPages || 1

    if (totalPages > 1) {
      const pending: Array<ReturnType<typeof fetchOpenPhishing>> = []
      for (let page = 2; page <= totalPages; page++) {
        pending.push(fetchOpenPhishing({ status: "confirmed", page, pageSize: 100 }))
      }
      const restPages = await Promise.all(pending)
      for (const pageData of restPages) {
        if (Array.isArray(pageData.items)) {
          phishingItems.push(...pageData.items)
        }
      }
    }

    const nextState: OpenDatasetState = {
      datasetVersion: String(manifest.version || currentState.datasetVersion || "unknown"),
      updatedAt: parseTimestamp(manifest.generatedAt),
      lastSyncedAt: Date.now(),
      apps: Array.isArray(apps.items) ? apps.items.map(normalizeAppRecord) : currentState.apps,
      phishingConfirmed: phishingItems.length
        ? phishingItems.map(normalizePhishingRecord)
        : currentState.phishingConfirmed
    }

    if (!nextState.apps.length) {
      nextState.apps = currentState.apps.length
        ? currentState.apps
        : createDefaultOpenDatasetState().apps
    }

    await setOpenDatasetState(nextState)
    return nextState
  } catch {
    if (currentState.apps.length) {
      return currentState
    }

    const fallback = createDefaultOpenDatasetState()
    await setOpenDatasetState(fallback)
    return fallback
  }
}

export async function getCurrentOpenDataset(): Promise<OpenDatasetState> {
  const state = await getOpenDatasetState()
  if (state.apps.length) {
    return state
  }
  return createDefaultOpenDatasetState()
}

export async function findOfficialUrlByBrand(brand?: string): Promise<string> {
  if (!brand) return "#"
  const dataset = await getCurrentOpenDataset()
  const software = dataset.apps.find(
    (item) => item.name === brand || item.nameEn.toLowerCase() === brand.toLowerCase()
  )

  if (software?.officialUrls?.[0]) return software.officialUrls[0]
  if (software?.officialDomains?.[0]) return `https://${software.officialDomains[0]}`
  return "#"
}
