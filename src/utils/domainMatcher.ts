import { DomainMatchResult } from "../types"
import { getAllOfficialDomains } from "../data/officialRegistry"

/**
 * Calculate Levenshtein distance between two strings
 * Used for detecting typosquatting domains
 */
export function levenshteinDistance(str1: string, str2: string): number {
  const len1 = str1.length
  const len2 = str2.length
  const matrix: number[][] = []

  // Initialize matrix
  for (let i = 0; i <= len1; i++) {
    matrix[i] = [i]
  }
  for (let j = 0; j <= len2; j++) {
    matrix[0][j] = j
  }

  // Fill matrix
  for (let i = 1; i <= len1; i++) {
    for (let j = 1; j <= len2; j++) {
      const cost = str1[i - 1] === str2[j - 1] ? 0 : 1
      matrix[i][j] = Math.min(
        matrix[i - 1][j] + 1, // deletion
        matrix[i][j - 1] + 1, // insertion
        matrix[i - 1][j - 1] + cost // substitution
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
    // Remove protocol
    let domain = url.replace(/^https?:\/\//, "").replace(/^www\./, "")
    // Remove port and path
    domain = domain.split("/")[0].split(":")[0]
    return domain
  } catch {
    return url
  }
}

/**
 * Check if domain matches any official domain exactly
 */
export function isOfficialDomain(domain: string): boolean {
  const normalizedDomain = extractDomain(domain).toLowerCase()
  const officialDomains = getAllOfficialDomains()

  return officialDomains.some((official) => {
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
export function checkDomainSimilarity(domain: string): DomainMatchResult | null {
  const normalizedDomain = extractDomain(domain).toLowerCase()
  const officialDomains = getAllOfficialDomains()

  for (const officialDomain of officialDomains) {
    const distance = levenshteinDistance(normalizedDomain, officialDomain)
    const maxLength = Math.max(normalizedDomain.length, officialDomain.length)
    const similarity = 1 - distance / maxLength

    // Threshold: if similarity > 0.7 (70%) and not exact match
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
export function detectTyposquattingPatterns(domain: string): boolean {
  const normalizedDomain = domain.toLowerCase()

  const patterns = [
    // Character substitution
    /fe1shu/,
    /d1ngtalk/,
    /wps-vip/,
    // Prefix patterns (e.g., desktop-wps.com)
    /^(desktop|pc|mobile|download|free|vip|official)-wps/,
    /^(desktop|pc|mobile|download|free|vip|official)-feishu/,
    /^(desktop|pc|mobile|download|free|vip|official)-dingtalk/,
    // Extra words
    /feishu-download/,
    /dingtalk-vip/,
    /wps-download/,
    // Hyphenation
    /fei-shu/,
    /ding-talk/,
    // Numbers at end
    /feishu\d+/,
    /dingtalk\d+/,
    /wps\d+/,
    // Common phishing patterns
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
    "so.com", // 360搜索
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
export function containsSensitiveKeywords(url: string, pageTitle?: string): boolean {
  // Skip check if it's a search engine
  if (isSearchEngine(url)) {
    console.log("  🔍 [关键词检测] 搜索引擎页面，跳过关键词检测")
    return false
  }

  const { getAllKeywords } = require("../data/officialRegistry")
  const allKeywords = getAllKeywords()
  const urlLower = url.toLowerCase()
  const titleLower = (pageTitle || "").toLowerCase()

  return allKeywords.some((keyword: string) =>
    urlLower.includes(keyword.toLowerCase()) ||
    titleLower.includes(keyword.toLowerCase())
  )
}
