/**
 * Official software registry entry
 */
export interface OfficialSoftware {
  id: string
  slug: string
  name: string
  nameEn: string
  officialDomains: string[]
  officialUrls: string[]
  keywords: string[]
  category: "office" | "communication" | "remote_control" | "security"
}

export interface OpenDatasetPhishingDomain {
  domain: string
  targetAppId?: string
  status: "confirmed"
  source: string
  firstSeenAt: string
  lastSeenAt: string
  reviewedAt: string
  reviewer: string
}

export interface OpenDatasetState {
  datasetVersion: string
  updatedAt: number
  lastSyncedAt: number
  apps: OfficialSoftware[]
  phishingConfirmed: OpenDatasetPhishingDomain[]
}

export type RiskVerdict = "allow" | "warn" | "block"
export type AnalysisLayer = "whitelist" | "blacklist" | "heuristics" | "cloud"

/**
 * Unified risk decision protocol shared by extension and cloud.
 */
export interface RiskDecision {
  verdict: RiskVerdict
  confidence: number // 0 - 100
  reason: string
  modelTraceId?: string
  matchedBrand?: string
}

/**
 * Result of security analysis
 */
export interface PhishingAnalysisResult extends RiskDecision {
  matchedSoftware?: OfficialSoftware
  layer: AnalysisLayer
  timestamp: number
  source: "local" | "cloud"
  datasetVersion?: string
}

/**
 * Cache entry for analysis results
 */
export interface AnalysisCache {
  cacheKey: string
  result: PhishingAnalysisResult
  expiresAt: number
}

/**
 * Domain similarity score
 */
export interface DomainMatchResult {
  isSimilar: boolean
  score: number
  officialDomain: string
  distance: number
}

/**
 * DOM content extracted for risk analysis
 */
export interface ExtractedDOMContent {
  url: string
  title: string
  metaDescription: string
  h1Text: string
  buttonTexts: string[]
  linkTexts: string[]
  footerText: string
  downloadKeywords: string[]
}

/**
 * Cloud analyze request payload
 */
export interface AnalyzeRequestPayload {
  url: string
  host: string
  path: string
  title: string
  h1Text: string
  buttonTexts: string[]
  downloadKeywords: string[]
  brandHint?: string
  layerHint: "heuristics" | "keyword"
}

/**
 * Activation and policy models for enterprise binding
 */
export interface TenantActivation {
  activated: boolean
  orgId?: string
  token?: string
  endpoint?: string
  activatedAt?: number
  tokenExpiresAt?: number
}

export type BrandSignalMode = "url_only" | "page_signals"

export interface EffectivePolicy {
  warningThreshold: number
  blockThreshold: number
  mode: "balanced" | "strict" | "relaxed"
  /** Free/default: url_only. Enterprise may enable page_signals via cloud policy. */
  brandSignalMode: BrandSignalMode
  policyVersion: string
  updatedAt: number
}

export interface RuntimeState {
  installationId: string
  firstInstalledAt: number
  lastVersion: string
}

export interface ReportingEvent {
  id: string
  ts: number
  eventType: "blocked" | "warned" | "bypassed" | "false_positive_feedback"
  orgId?: string
  installationId: string
  urlHost: string
  riskVerdict: RiskVerdict
  confidence: number
  layer: AnalysisLayer
  actionTaken: "auto_blocked" | "shown_warning" | "continued" | "allowed"
  reason: string
  matchedBrand?: string
  titleDigest?: string
  h1Digest?: string
  datasetVersion?: string
  attempts?: number
}

/**
 * Storage schema for chrome.storage.local
 */
export interface ExtensionStorage {
  analysisCache: Record<string, string>
  blacklist: string[]
  stats: {
    totalScans: number
    phishingBlocked: number
    warningShown: number
    officialVerified: number
  }
  settings: {
    warningThreshold: number
    blockThreshold: number
    cacheExpiry: number // default 86400000 (24h)
  }
  runtime: RuntimeState
  tenant: {
    activation: TenantActivation
  }
  policy: {
    effective: EffectivePolicy
  }
  reporting: {
    queue: ReportingEvent[]
    lastUploadAt?: number
  }
  openDataset: OpenDatasetState
}

/**
 * Backward compatibility for legacy model outputs
 */
export interface LegacyAIAnalysisResponse {
  isPhishing?: boolean
  is_phishing?: boolean
  confidence: number
  reason: string
  suspiciousElements?: string[]
  suspicious_elements?: string[]
}
