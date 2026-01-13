import { PhishingAnalysisResult, ExtractedDOMContent, OfficialSoftware } from "../types"
import {
  isOfficialDomain,
  checkDomainSimilarity,
  detectTyposquattingPatterns,
  containsSensitiveKeywords,
  isSearchEngine
} from "../utils/domainMatcher"
import { getSoftwareByDomain, getAllKeywords } from "../data/officialRegistry"
import { analyzeWithAI } from "./aiAnalyzer"
import { getFromCache, saveToCache, getBlacklist, getSettings } from "../utils/cache"

/**
 * Layer 1: Local Fast Match (<10ms)
 * - Whitelist check -> Allow immediately
 * - Blacklist check -> Block immediately
 */
export async function layer1LocalMatch(url: string): Promise<PhishingAnalysisResult | null> {
  // Check if it's a search engine (safe)
  if (isSearchEngine(url)) {
    console.log("✅ [Layer 1] 搜索引擎页面，直接通过")
    return {
      isPhishing: false,
      confidence: 100,
      reason: "搜索引擎页面（百度、Bing、Google等）",
      layer: "whitelist",
      timestamp: Date.now()
    }
  }

  // Check whitelist
  if (isOfficialDomain(url)) {
    const software = getSoftwareByDomain(url)
    return {
      isPhishing: false,
      confidence: 100,
      reason: `官方认证域名：${software?.name || "已知官方站点"}`,
      matchedSoftware: software,
      layer: "whitelist",
      timestamp: Date.now()
    }
  }

  // Check blacklist (from chrome.storage)
  const blacklist = await getBlacklist()

  if (blacklist.some((blocked) => url.includes(blocked))) {
    return {
      isPhishing: true,
      confidence: 100,
      reason: "已知钓鱼网站（黑名单）",
      layer: "blacklist",
      timestamp: Date.now()
    }
  }

  return null // No match, proceed to Layer 2
}

/**
 * Layer 2: Heuristic Analysis (<50ms)
 * - Check for suspicious domain patterns
 * - Check for trigger keywords in URL/domain
 */
export async function layer2Heuristics(
  url: string,
  pageTitle?: string
): Promise<PhishingAnalysisResult | null> {
  console.log("  🔎 [Layer 2] 检查域名相似度...")
  // Check domain similarity
  const similarityResult = checkDomainSimilarity(url)
  if (similarityResult) {
    const software = getSoftwareByDomain(similarityResult.officialDomain)
    console.log("  ⚠️ [Layer 2] 发现相似域名！")
    console.log("  ⚠️ [Layer 2] 相似度:", Math.round(similarityResult.score * 100) + "%")
    console.log("  ⚠️ [Layer 2] 相似域名:", similarityResult.officialDomain)
    return {
      isPhishing: true,
      confidence: Math.round(similarityResult.score * 100),
      reason: `域名与官方站点高度相似（${similarityResult.officialDomain}）`,
      matchedSoftware: software,
      layer: "heuristics",
      timestamp: Date.now()
    }
  }
  console.log("  ✓ [Layer 2] 域名相似度检测通过")

  console.log("  🔎 [Layer 2] 检查 Typosquatting 模式...")
  // Check typosquatting patterns
  if (detectTyposquattingPatterns(url)) {
    console.log("  ⚠️ [Layer 2] 匹配到钓鱼域名模式！")
    return {
      isPhishing: true,
      confidence: 85,
      reason: "检测到域名混淆模式（typosquatting）",
      layer: "heuristics",
      timestamp: Date.now()
    }
  }
  console.log("  ✓ [Layer 2] Typosquatting 检测通过")

  // Check if URL/page title contains sensitive keywords
  console.log("  🔎 [Layer 2] 检查敏感关键词...")
  const hasKeyword = containsSensitiveKeywords(url, pageTitle)
  console.log("  ", hasKeyword ? "⚠️ 发现敏感关键词" : "✓ 无敏感关键词")

  if (hasKeyword) {
    // Suspicious but not certain - proceed to Layer 3
    console.log("  ⏭️ [Layer 2] 需要进一步 AI 分析")
    return null
  }

  // No keywords found, likely safe
  console.log("  ✅ [Layer 2] 未检测到威胁")
  return {
    isPhishing: false,
    confidence: 70,
    reason: "未检测到敏感关键词",
    layer: "heuristics",
    timestamp: Date.now()
  }
}

/**
 * Layer 3: AI Semantic Analysis (500ms-2s, async)
 * - Extract DOM content
 * - Send to LLM for analysis
 * - Cache results for 24h
 */
export async function layer3AIAnalysis(
  url: string,
  domContent: ExtractedDOMContent
): Promise<PhishingAnalysisResult> {
  // Check cache first
  const cached = await getFromCache(url)
  if (cached) {
    return cached.result
  }

  // Perform AI analysis
  const aiResult = await analyzeWithAI(url, domContent)

  // Try to match software from URL, content, or AI's reasoning
  let matchedSoftware: OfficialSoftware | undefined

  console.log("  🔍 [Layer 3] 开始软件匹配...")
  console.log("  🔍 [Layer 3] AI 判定理由:", aiResult.reason)

  const { OFFICIAL_SOFTWARE_REGISTRY } = require("../data/officialRegistry")

  // Priority 1: Extract software name from AI's reasoning (most accurate)
  const reasoning = aiResult.reason.toLowerCase()
  console.log("  🔍 [Layer 3] 检查 AI 判定理由中的软件名称...")
  console.log("  🔍 [Layer 3] 判定理由小写:", reasoning)

  for (const software of OFFICIAL_SOFTWARE_REGISTRY) {
    const nameLower = software.name.toLowerCase()
    const nameEnLower = software.nameEn.toLowerCase()
    const nameMatch = reasoning.includes(nameLower)
    const nameEnMatch = reasoning.includes(nameEnLower)

    if (nameMatch || nameEnMatch) {
      matchedSoftware = software
      console.log("  💡 [Layer 3] 从 AI 判定理由中匹配到软件:", software.name)
      console.log("  💡 [Layer 3] 匹配依据:", nameMatch ? `name="${nameLower}"` : `nameEn="${nameEnLower}"`)
      break
    }
  }

  // Priority 2: Extract from URL
  if (!matchedSoftware) {
    const urlLower = url.toLowerCase()
    for (const software of OFFICIAL_SOFTWARE_REGISTRY) {
      if (software.officialDomains.some((domain) => urlLower.includes(domain.toLowerCase()))) {
        matchedSoftware = software
        console.log("  💡 [Layer 3] 从 URL 中匹配到软件:", software.name)
        break
      }
    }
  }

  // Priority 3: Keyword matching (least accurate, use as last resort)
  if (!matchedSoftware) {
    const allText = [
      url,
      domContent.title,
      domContent.h1Text
    ].join(" ").toLowerCase()

    console.log("  🔍 [Layer 3] 使用关键词匹配，匹配文本:", allText.substring(0, 200))

    // Score each software by number of matched keywords
    let bestMatch: OfficialSoftware | undefined
    let bestScore = 0

    for (const software of OFFICIAL_SOFTWARE_REGISTRY) {
      const matchedKeywords = software.keywords.filter((kw) => allText.includes(kw.toLowerCase()))
      const score = matchedKeywords.length

      if (score > bestScore) {
        bestMatch = software
        bestScore = score
      }
    }

    if (bestMatch && bestScore > 0) {
      matchedSoftware = bestMatch
      console.log("  💡 [Layer 3] 关键词匹配到软件:", matchedSoftware.name)
      console.log("  💡 [Layer 3] 匹配关键词数:", bestScore)
    }
  }

  if (!matchedSoftware) {
    console.log("  ⚠️ [Layer 3] 未能匹配到已知软件")
  }

  const result: PhishingAnalysisResult = {
    isPhishing: aiResult.isPhishing,
    confidence: aiResult.confidence,
    reason: aiResult.reason,
    matchedSoftware,
    layer: "ai",
    timestamp: Date.now()
  }

  // Cache the result
  await saveToCache(url, result)

  return result
}

/**
 * Main orchestration: Three-layer filtering funnel
 */
export async function analyzePageSecurity(
  url: string,
  domContent?: ExtractedDOMContent,
  pageTitle?: string
): Promise<PhishingAnalysisResult> {
  console.log("\n▶️ [三层过滤] 开始分析")
  console.log("▶️ [三层过滤] URL:", url)

  // Layer 1: Local match
  console.log("\n🔍 [Layer 1] 本地匹配检测 (<10ms)")
  const layer1Result = await layer1LocalMatch(url)
  if (layer1Result) {
    console.log("✅ [Layer 1] 匹配成功！")
    console.log("✅ [Layer 1] 结果:", layer1Result.reason)
    console.log("✅ [Layer 1] 跳过后续分析")
    return layer1Result
  }
  console.log("⏭️ [Layer 1] 无匹配，进入 Layer 2")

  // Layer 2: Heuristics
  console.log("\n🔍 [Layer 2] 启发式分析 (<50ms)")
  const layer2Result = await layer2Heuristics(url, pageTitle)

  // If Layer 2 is confident enough, skip AI
  if (layer2Result && layer2Result.confidence >= 60) {
    console.log("⚠️ [Layer 2] 检测到威胁！")
    console.log("⚠️ [Layer 2] 结果:", layer2Result.reason)
    console.log("⚠️ [Layer 2] 置信度:", layer2Result.confidence + "%")
    console.log("⚠️ [Layer 2] 跳过 AI 分析")
    return layer2Result
  }

  if (layer2Result) {
    console.log("⏭️ [Layer 2] 置信度不足 (", layer2Result.confidence + "% < 60%)，进入 Layer 3")
  } else {
    console.log("⏭️ [Layer 2] 无明确结论，进入 Layer 3")
  }

  // Layer 3: AI Analysis (only if DOM content provided)
  if (domContent) {
    console.log("\n🤖 [Layer 3] AI 语义分析 (500ms-2s)")
    const aiResult = await layer3AIAnalysis(url, domContent)
    console.log("🤖 [Layer 3] 分析完成")
    return aiResult
  }

  // Fallback: insufficient data
  console.log("⚠️ [三层过滤] DOM 内容不足，无法完成 AI 分析")
  return {
    isPhishing: false,
    confidence: 50,
    reason: "无法确定安全性（需AI分析）",
    layer: "heuristics",
    timestamp: Date.now()
  }
}
