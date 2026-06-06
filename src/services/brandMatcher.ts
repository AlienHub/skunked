import { OFFICIAL_SOFTWARE_REGISTRY } from "../data/officialRegistry"
import { OfficialSoftware } from "../types"
import { extractDomain, isSameOrSubdomain } from "../utils/domainMatcher"

export interface BrandMatchResult {
  software?: OfficialSoftware
  score: number
}

function scoreKeywordMatch(text: string, keywords: string[]): number {
  return keywords.reduce((acc, keyword) => {
    return acc + (text.includes(keyword.toLowerCase()) ? 1 : 0)
  }, 0)
}

export function matchBrandFromSignals(
  signals: {
    url: string
    title?: string
    h1Text?: string
    buttonTexts?: string[]
  },
  registry: OfficialSoftware[] = OFFICIAL_SOFTWARE_REGISTRY
): BrandMatchResult {
  const domain = extractDomain(signals.url).toLowerCase()
  const fullText = [
    signals.url,
    signals.title || "",
    signals.h1Text || "",
    ...(signals.buttonTexts || [])
  ]
    .join(" ")
    .toLowerCase()

  let bestScore = 0
  let bestMatch: OfficialSoftware | undefined

  for (const software of registry) {
    let score = scoreKeywordMatch(
      fullText,
      software.keywords.map((k) => k.toLowerCase())
    )

    if (
      software.officialDomains.some((officialDomain) =>
        isSameOrSubdomain(domain, officialDomain)
      )
    ) {
      score += 6
    }

    if (
      fullText.includes(software.name.toLowerCase()) ||
      fullText.includes(software.nameEn.toLowerCase())
    ) {
      score += 4
    }

    if (score > bestScore) {
      bestScore = score
      bestMatch = software
    }
  }

  return {
    software: bestScore > 1 ? bestMatch : undefined,
    score: bestScore
  }
}
