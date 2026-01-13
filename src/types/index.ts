/**
 * Official software registry entry
 */
export interface OfficialSoftware {
  id: string
  name: string
  nameEn: string
  officialDomains: string[]
  keywords: string[]
  category: "office" | "communication" | "remote_control" | "security"
}

/**
 * Result of security analysis
 */
export interface PhishingAnalysisResult {
  isPhishing: boolean
  confidence: number // 0-100
  reason: string
  matchedSoftware?: OfficialSoftware
  layer: "whitelist" | "blacklist" | "heuristics" | "ai"
  timestamp: number
}

/**
 * Cache entry for analysis results
 */
export interface AnalysisCache {
  url: string
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
 * DOM content extracted for AI analysis
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
 * AI API response
 */
export interface AIAnalysisResponse {
  isPhishing: boolean
  confidence: number
  reason: string
  suspiciousElements: string[]
}

/**
 * Storage schema for chrome.storage.local
 */
export interface ExtensionStorage {
  analysisCache: Record<string, string> // Base64 URL -> JSON string
  blacklist: string[]
  stats: {
    totalScans: number
    phishingBlocked: number
    warningShown: number
    officialVerified: number
  }
  settings: {
    enableAI: boolean
    warningThreshold: number // default 60
    blockThreshold: number // default 90
    cacheExpiry: number // default 86400000 (24h)
  }
}
