import {
  AnalyzeRequestPayload,
  BrandSignalMode,
  EffectivePolicy,
  ExtractedDOMContent,
  OfficialSoftware,
  OpenDatasetState,
  PhishingAnalysisResult
} from "../types"
import {
  getBlacklist,
  getEffectivePolicy,
  getFromCache,
  getTenantActivation,
  saveToCache
} from "../utils/cache"
import {
  checkDomainSimilarity,
  containsSensitiveKeywords,
  detectTyposquattingPatterns,
  extractDomain,
  isOfficialDomain,
  isSameOrSubdomain,
  isSearchEngine
} from "../utils/domainMatcher"
import { analyzeWithAI, hasLocalModelConfig } from "./aiAnalyzer"
import { matchBrandFromSignals } from "./brandMatcher"
import { getCurrentOpenDataset } from "./openDataset"

export const NEEDS_DOM_REVIEW_REASON = "无可用上下文，默认放行"

function buildResult(
  input: Omit<PhishingAnalysisResult, "timestamp" | "source"> & {
    source?: "local" | "cloud"
  }
): PhishingAnalysisResult {
  return {
    ...input,
    timestamp: Date.now(),
    source: input.source || "local"
  }
}

function resolveVerdictByPolicy(
  confidence: number,
  policy: EffectivePolicy
): "allow" | "warn" | "block" {
  if (confidence >= policy.blockThreshold) return "block"
  if (confidence >= policy.warningThreshold) return "warn"
  return "allow"
}

function datasetOfficialDomains(dataset: OpenDatasetState): string[] {
  return dataset.apps.flatMap((app) => app.officialDomains)
}

const DOWNLOAD_INTENT_KEYWORDS = [
  "下载",
  "download",
  "安装",
  "install",
  "setup",
  "客户端",
  "client",
  "pc版",
  "windows",
  "mac",
  "exe",
  "dmg"
]

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
}

function dedupeNonEmpty(values: string[]): string[] {
  const seen = new Set<string>()
  const output: string[] = []

  for (const item of values) {
    const normalized = item.trim().toLowerCase()
    if (!normalized || seen.has(normalized)) continue
    seen.add(normalized)
    output.push(normalized)
  }

  return output
}

function domainStem(value: string): string {
  const host = extractDomain(value).toLowerCase()
  const labels = host.split(".")
  return labels[0] || host
}

function identityAnchorsForApp(app: OfficialSoftware): string[] {
  return dedupeNonEmpty([
    app.id,
    app.slug,
    app.name,
    app.nameEn,
    ...app.officialDomains.map((domain) => domainStem(domain))
  ])
}

function textIncludesToken(text: string, token: string): boolean {
  const normalizedText = text.toLowerCase()
  const normalizedToken = token.trim().toLowerCase()
  if (!normalizedToken) return false

  // CJK tokens are usually meaningful enough for direct substring matching.
  if (/[^\u0000-\u007f]/.test(normalizedToken)) {
    return normalizedText.includes(normalizedToken)
  }

  if (/^[a-z0-9-]+$/.test(normalizedToken) && normalizedToken.length <= 3) {
    const pattern = new RegExp(
      `(^|[^a-z0-9])${escapeRegex(normalizedToken)}([^a-z0-9]|$)`,
      "i"
    )
    return pattern.test(normalizedText)
  }

  return normalizedText.includes(normalizedToken)
}

function resolveScopedApps(
  url: string,
  pageTitle: string | undefined,
  dataset: OpenDatasetState,
  brandSignalMode: BrandSignalMode,
  domContent?: ExtractedDOMContent
): OfficialSoftware[] {
  const pageSignalText = [
    pageTitle || "",
    domContent?.title || "",
    domContent?.h1Text || "",
    ...(domContent?.buttonTexts || [])
  ].join(" ")
  const signalText =
    brandSignalMode === "page_signals"
      ? `${url} ${pageSignalText}`.toLowerCase()
      : url.toLowerCase()

  return dataset.apps.filter((app) =>
    identityAnchorsForApp(app).some((anchor) =>
      textIncludesToken(signalText, anchor)
    )
  )
}

function hasDownloadIntent(
  url: string,
  pageTitle?: string,
  domContent?: ExtractedDOMContent
): boolean {
  const text = [
    url,
    pageTitle || "",
    domContent?.title || "",
    domContent?.h1Text || "",
    ...(domContent?.buttonTexts || []),
    ...(domContent?.linkTexts || []),
    ...(domContent?.downloadKeywords || [])
  ]
    .join(" ")
    .toLowerCase()
  return DOWNLOAD_INTENT_KEYWORDS.some((keyword) => text.includes(keyword))
}

function matchKnownPhishingDomain(url: string, dataset: OpenDatasetState) {
  const matched = dataset.phishingConfirmed.find((record) =>
    isSameOrSubdomain(url, record.domain)
  )

  if (!matched) return null

  const software = matched.targetAppId
    ? dataset.apps.find((item) => item.id === matched.targetAppId)
    : undefined

  return {
    record: matched,
    software
  }
}

/**
 * Layer 1: Local Fast Match (<10ms)
 */
export async function layer1LocalMatch(
  url: string,
  dataset: OpenDatasetState
): Promise<PhishingAnalysisResult | null> {
  if (isSearchEngine(url)) {
    return buildResult({
      verdict: "allow",
      confidence: 100,
      reason: "搜索引擎页面，跳过拦截",
      layer: "whitelist",
      datasetVersion: dataset.datasetVersion
    })
  }

  const officialDomains = datasetOfficialDomains(dataset)
  if (isOfficialDomain(url, officialDomains)) {
    const software = dataset.apps.find((app) =>
      app.officialDomains.some((officialDomain) =>
        isSameOrSubdomain(url, officialDomain)
      )
    )

    return buildResult({
      verdict: "allow",
      confidence: 100,
      reason: `官方认证域名：${software?.name || "已知官方站点"}`,
      matchedSoftware: software,
      matchedBrand: software?.name,
      layer: "whitelist",
      datasetVersion: dataset.datasetVersion
    })
  }

  const datasetHit = matchKnownPhishingDomain(url, dataset)
  if (datasetHit) {
    return buildResult({
      verdict: "block",
      confidence: 100,
      reason: "命中公开确认钓鱼域名库",
      matchedSoftware: datasetHit.software,
      matchedBrand: datasetHit.software?.name,
      layer: "blacklist",
      datasetVersion: dataset.datasetVersion
    })
  }

  const localBlacklist = await getBlacklist()
  if (localBlacklist.some((blocked) => isSameOrSubdomain(url, blocked))) {
    return buildResult({
      verdict: "block",
      confidence: 100,
      reason: "命中本地黑名单",
      layer: "blacklist",
      datasetVersion: dataset.datasetVersion
    })
  }

  return null
}

/**
 * Layer 2: Heuristic Analysis (<50ms)
 */
export async function layer2Heuristics(
  url: string,
  pageTitle: string | undefined,
  policy: EffectivePolicy,
  dataset: OpenDatasetState,
  domContent?: ExtractedDOMContent
): Promise<{
  immediate?: PhishingAnalysisResult
  shouldEscalateToCloud: boolean
  layerHint: "heuristics" | "keyword"
  reason: string
}> {
  if (detectTyposquattingPatterns(url, { includeGenericPatterns: false })) {
    return {
      immediate: buildResult({
        verdict: "block",
        confidence: 86,
        reason: "检测到品牌域名混淆模式",
        layer: "heuristics",
        datasetVersion: dataset.datasetVersion
      }),
      shouldEscalateToCloud: false,
      layerHint: "heuristics",
      reason: "brand-typosquatting"
    }
  }

  const scopedApps = resolveScopedApps(
    url,
    pageTitle,
    dataset,
    policy.brandSignalMode,
    domContent
  )
  if (!scopedApps.length) {
    if (policy.brandSignalMode === "page_signals" && !pageTitle) {
      return {
        shouldEscalateToCloud: false,
        layerHint: "heuristics",
        reason: "needs-page-signals"
      }
    }

    return {
      immediate: buildResult({
        verdict: resolveVerdictByPolicy(8, policy),
        confidence: 8,
        reason: "非受保护软件场景，跳过深度检测",
        layer: "heuristics",
        datasetVersion: dataset.datasetVersion
      }),
      shouldEscalateToCloud: false,
      layerHint: "heuristics",
      reason: "out-of-scope"
    }
  }

  const scopedOfficialDomains = scopedApps.flatMap((app) => app.officialDomains)
  const similarityResult = checkDomainSimilarity(url, scopedOfficialDomains)

  if (similarityResult) {
    const software = scopedApps.find((app) =>
      app.officialDomains.includes(similarityResult.officialDomain)
    )

    return {
      immediate: buildResult({
        verdict: "block",
        confidence: Math.max(88, Math.round(similarityResult.score * 100)),
        reason: `域名与官方站点高度相似（${similarityResult.officialDomain}）`,
        matchedSoftware: software,
        matchedBrand: software?.name,
        layer: "heuristics",
        datasetVersion: dataset.datasetVersion
      }),
      shouldEscalateToCloud: false,
      layerHint: "heuristics",
      reason: "similar-domain"
    }
  }

  if (detectTyposquattingPatterns(url, { includeGenericPatterns: true })) {
    return {
      immediate: buildResult({
        verdict: "block",
        confidence: 86,
        reason: "检测到域名混淆模式",
        layer: "heuristics",
        datasetVersion: dataset.datasetVersion
      }),
      shouldEscalateToCloud: false,
      layerHint: "heuristics",
      reason: "typosquatting"
    }
  }

  const scopedKeywords = scopedApps.flatMap((app) => app.keywords)
  const keywordHit = containsSensitiveKeywords(url, pageTitle, scopedKeywords)
  const downloadIntent = hasDownloadIntent(url, pageTitle, domContent)

  if (keywordHit && downloadIntent) {
    return {
      shouldEscalateToCloud: true,
      layerHint: "keyword",
      reason: "keyword-triggered"
    }
  }

  if (keywordHit && !downloadIntent) {
    const warnConfidence = Math.max(policy.warningThreshold, 62)
    return {
      immediate: buildResult({
        verdict: "warn",
        confidence: warnConfidence,
        reason: "页面疑似冒充受保护软件官网，未发现明确下载入口，请谨慎访问",
        matchedSoftware: scopedApps[0],
        matchedBrand: scopedApps[0]?.name,
        layer: "heuristics",
        datasetVersion: dataset.datasetVersion
      }),
      shouldEscalateToCloud: false,
      layerHint: "heuristics",
      reason: "brand-without-download-intent"
    }
  }

  return {
    immediate: buildResult({
      verdict: resolveVerdictByPolicy(20, policy),
      confidence: 20,
      reason: "未发现钓鱼特征",
      layer: "heuristics",
      datasetVersion: dataset.datasetVersion
    }),
    shouldEscalateToCloud: false,
    layerHint: "heuristics",
    reason: "no-signal"
  }
}

/**
 * Layer 3: Cloud Semantic Analysis
 */
export async function layer3CloudAnalysis(
  url: string,
  domContent: ExtractedDOMContent,
  layerHint: "heuristics" | "keyword",
  policy: EffectivePolicy,
  dataset: OpenDatasetState
): Promise<PhishingAnalysisResult> {
  const cached = await getFromCache(url)
  if (cached) {
    return {
      ...cached.result,
      datasetVersion: cached.result.datasetVersion || dataset.datasetVersion
    }
  }

  const activation = await getTenantActivation()
  const hasLocalModel = await hasLocalModelConfig()
  if (!hasLocalModel && (!activation.activated || !activation.token)) {
    const warnConfidence = Math.max(policy.warningThreshold, 62)
    const fallback = buildResult({
      verdict: "warn",
      confidence: warnConfidence,
      reason: "页面疑似冒充受保护软件官网，当前基于本地规则提示风险",
      layer: "heuristics",
      datasetVersion: dataset.datasetVersion
    })
    await saveToCache(url, fallback)
    return fallback
  }

  const brandMatch = matchBrandFromSignals(
    {
      url,
      title: domContent.title,
      h1Text: domContent.h1Text,
      buttonTexts: domContent.buttonTexts
    },
    dataset.apps
  )

  const payload: AnalyzeRequestPayload = {
    url,
    host: (() => {
      try {
        return new URL(url).host
      } catch {
        return ""
      }
    })(),
    path: (() => {
      try {
        return new URL(url).pathname
      } catch {
        return "/"
      }
    })(),
    title: domContent.title,
    h1Text: domContent.h1Text,
    buttonTexts: domContent.buttonTexts.slice(0, 10),
    downloadKeywords: domContent.downloadKeywords.slice(0, 10),
    brandHint: brandMatch.software?.name,
    layerHint
  }

  try {
    const cloudDecision = await analyzeWithAI(payload)
    const verdict =
      cloudDecision.verdict ||
      resolveVerdictByPolicy(cloudDecision.confidence, policy)

    const result = buildResult({
      verdict,
      confidence: cloudDecision.confidence,
      reason: cloudDecision.reason,
      matchedBrand: cloudDecision.matchedBrand || brandMatch.software?.name,
      matchedSoftware: brandMatch.software,
      layer: "cloud",
      modelTraceId: cloudDecision.modelTraceId,
      source: hasLocalModel ? "local" : "cloud",
      datasetVersion: dataset.datasetVersion
    })

    await saveToCache(url, result)
    return result
  } catch {
    const fallbackConfidence = Math.max(0, policy.warningThreshold - 5)
    const fallback = buildResult({
      verdict: resolveVerdictByPolicy(fallbackConfidence, policy),
      confidence: fallbackConfidence,
      reason: "云分析暂不可用，已降级为低风险放行",
      matchedSoftware: brandMatch.software,
      matchedBrand: brandMatch.software?.name,
      layer: "cloud",
      datasetVersion: dataset.datasetVersion
    })
    await saveToCache(url, fallback)
    return fallback
  }
}

export async function analyzePageSecurity(
  url: string,
  domContent?: ExtractedDOMContent,
  pageTitle?: string
): Promise<PhishingAnalysisResult> {
  const [policy, dataset] = await Promise.all([
    getEffectivePolicy(),
    getCurrentOpenDataset()
  ])

  const layer1Result = await layer1LocalMatch(url, dataset)
  if (layer1Result) {
    return layer1Result
  }

  const layer2Result = await layer2Heuristics(
    url,
    pageTitle,
    policy,
    dataset,
    domContent
  )
  if (layer2Result.immediate) {
    return layer2Result.immediate
  }

  if (domContent && layer2Result.shouldEscalateToCloud) {
    return layer3CloudAnalysis(
      url,
      domContent,
      layer2Result.layerHint,
      policy,
      dataset
    )
  }

  return buildResult({
    verdict: "allow",
    confidence: 30,
    reason: NEEDS_DOM_REVIEW_REASON,
    layer: "heuristics",
    datasetVersion: dataset.datasetVersion
  })
}
