import { getAllKeywords, getAllOfficialDomains } from "../data/officialRegistry"
import { DomainMatchResult } from "../types"

/**
 * Calculate Levenshtein distance between two strings
 * Used for detecting typosquatting domains
 */
export function levenshteinDistance(str1: string, str2: string): number {
  const len1 = str1.length
  const len2 = str2.length
  const matrix: number[][] = []

  for (let i = 0; i <= len1; i++) {
    matrix[i] = [i]
  }
  for (let j = 0; j <= len2; j++) {
    matrix[0][j] = j
  }

  for (let i = 1; i <= len1; i++) {
    for (let j = 1; j <= len2; j++) {
      const cost = str1[i - 1] === str2[j - 1] ? 0 : 1
      matrix[i][j] = Math.min(
        matrix[i - 1][j] + 1,
        matrix[i][j - 1] + 1,
        matrix[i - 1][j - 1] + cost
      )
    }
  }

  return matrix[len1][len2]
}

/**
 * Extract root domain from URL
 * e.g., "www.feishu.cn" -> "feishu.cn"
 */
export function extractDomain(url: string): string {
  try {
    let domain = url.replace(/^https?:\/\//, "").replace(/^www\./, "")
    domain = domain.split("/")[0].split(":")[0]
    return domain
  } catch {
    return url
  }
}

export function isSameOrSubdomain(host: string, domain: string): boolean {
  const normalizedHost = extractDomain(host).toLowerCase()
  const normalizedDomain = extractDomain(domain).toLowerCase()

  return (
    normalizedHost === normalizedDomain ||
    normalizedHost.endsWith(`.${normalizedDomain}`)
  )
}

/**
 * Check if domain matches any official domain exactly
 */
export function isOfficialDomain(domain: string, officialDomains?: string[]): boolean {
  const normalizedDomain = extractDomain(domain).toLowerCase()
  const candidates = officialDomains?.length ? officialDomains : getAllOfficialDomains()

  return candidates.some((official) => {
    const normalizedOfficial = official.toLowerCase()
    return (
      normalizedDomain === normalizedOfficial ||
      normalizedDomain.endsWith(`.${normalizedOfficial}`)
    )
  })
}

/**
 * Check if domain is suspiciously similar to official domains
 */
export function checkDomainSimilarity(
  domain: string,
  officialDomains?: string[]
): DomainMatchResult | null {
  const normalizedDomain = extractDomain(domain).toLowerCase()
  const candidates = officialDomains?.length ? officialDomains : getAllOfficialDomains()

  for (const officialDomain of candidates) {
    const distance = levenshteinDistance(normalizedDomain, officialDomain)
    const maxLength = Math.max(normalizedDomain.length, officialDomain.length)
    const similarity = 1 - distance / maxLength

    if (similarity > 0.7 && similarity < 1.0) {
      return {
        isSimilar: true,
        score: similarity,
        officialDomain,
        distance
      }
    }
  }

  return null
}

/**
 * Check for common typosquatting patterns
 */
export function detectTyposquattingPatterns(
  domain: string,
  options: { includeGenericPatterns?: boolean } = {}
): boolean {
  const normalizedDomain = extractDomain(domain).toLowerCase()
  const includeGenericPatterns = options.includeGenericPatterns ?? true

  const brandPatterns = [
    /fe1shu/,
    /d1ngtalk/,
    /wps-vip/,
    /^(desktop|pc|mobile|download|free|vip|official)-wps/,
    /^(desktop|pc|mobile|download|free|vip|official)-feishu/,
    /^(desktop|pc|mobile|download|free|vip|official)-dingtalk/,
    /feishu-download/,
    /dingtalk-vip/,
    /wps-download/,
    /fei-shu/,
    /ding-talk/,
    /feishu\d+/,
    /dingtalk\d+/,
    /wps\d+/
  ]

  const genericPatterns = [
    /-download\./,
    /-vip\./,
    /-free\./,
    /-platform\./,
    /-setup\./,
    /-install\./,
    /\.xyz/,
    /\.top$/,
    /\.tk$/,
    /\.xyz$/,
    /\.club$/,
    /\.site$/
  ]

  const patterns = includeGenericPatterns
    ? [...brandPatterns, ...genericPatterns]
    : brandPatterns

  return patterns.some((pattern) => pattern.test(normalizedDomain))
}

/**
 * Check if URL is a known search engine
 */
export function isSearchEngine(url: string): boolean {
  const domain = extractDomain(url).toLowerCase()
  const searchEngines = [
    "baidu.com",
    "bing.com",
    "google.com",
    "google.com.hk",
    "sogou.com",
    "so.com",
    "yahoo.com",
    "duckduckgo.com",
    "yandex.com",
    "haosou.com"
  ]

  return searchEngines.some((engine) =>
    domain === engine || domain.endsWith(`.${engine}`)
  )
}

/**
 * Check if URL contains sensitive keywords
 */
export function containsSensitiveKeywords(
  url: string,
  pageTitle?: string,
  keywords?: string[]
): boolean {
  if (isSearchEngine(url)) {
    return false
  }

  const allKeywords = keywords?.length ? keywords : getAllKeywords()
  const urlLower = url.toLowerCase()
  const titleLower = (pageTitle || "").toLowerCase()

  return allKeywords.some((keyword: string) =>
    urlLower.includes(keyword.toLowerCase()) ||
    titleLower.includes(keyword.toLowerCase())
  )
}
