import { describe, expect, it } from "vitest"

import {
  checkDomainSimilarity,
  containsSensitiveKeywords,
  detectTyposquattingPatterns,
  extractDomain,
  isOfficialDomain,
  isSameOrSubdomain,
  isSearchEngine,
  levenshteinDistance
} from "./domainMatcher"

describe("domainMatcher", () => {
  it("computes levenshtein distance", () => {
    expect(levenshteinDistance("kitten", "sitting")).toBe(3)
    expect(levenshteinDistance("feishu.cn", "feishu.cn")).toBe(0)
  })

  it("extracts and normalizes domains", () => {
    expect(extractDomain("https://www.feishu.cn/download")).toBe("feishu.cn")
    expect(extractDomain("www.example.com:8080/path")).toBe("example.com")
  })

  it("matches official domains and subdomains", () => {
    const official = ["feishu.cn"]
    expect(isOfficialDomain("https://www.feishu.cn", official)).toBe(true)
    expect(isOfficialDomain("https://app.feishu.cn", official)).toBe(true)
    expect(isOfficialDomain("https://feishu-evil.example", official)).toBe(false)
  })

  it("detects same host or subdomain relationship", () => {
    expect(isSameOrSubdomain("app.feishu.cn", "feishu.cn")).toBe(true)
    expect(isSameOrSubdomain("feishu.cn", "feishu.cn")).toBe(true)
    expect(isSameOrSubdomain("evil.com", "feishu.cn")).toBe(false)
  })

  it("flags similar domains without exact match", () => {
    const result = checkDomainSimilarity("feishu.co", ["feishu.cn"])
    expect(result).not.toBeNull()
    expect(result?.isSimilar).toBe(true)
    expect(result?.officialDomain).toBe("feishu.cn")
  })

  it("detects brand typosquatting patterns", () => {
    expect(detectTyposquattingPatterns("https://fe1shu.cn")).toBe(true)
    expect(
      detectTyposquattingPatterns("https://safe.example.com", {
        includeGenericPatterns: false
      })
    ).toBe(false)
  })

  it("skips sensitive keyword checks on search engines", () => {
    expect(
      containsSensitiveKeywords("https://www.baidu.com/s?wd=飞书下载", "飞书下载", [
        "飞书"
      ])
    ).toBe(false)
    expect(isSearchEngine("https://www.baidu.com")).toBe(true)
  })

  it("matches sensitive keywords in url or title", () => {
    expect(
      containsSensitiveKeywords("https://fake.example/", "飞书官方下载", ["飞书"])
    ).toBe(true)
    expect(
      containsSensitiveKeywords("https://fake.example/feishu-download", undefined, [
        "feishu"
      ])
    ).toBe(true)
  })
})
