import { beforeEach, describe, expect, it, vi } from "vitest"

import {
  TEST_DATASET,
  TEST_POLICY,
  TEST_POLICY_PAGE_SIGNALS
} from "../test/fixtures"
import type { ExtractedDOMContent } from "../types"
import {
  getBlacklist,
  getFromCache,
  getTenantActivation,
  saveToCache
} from "../utils/cache"
import { analyzeWithAI, hasLocalModelConfig } from "./aiAnalyzer"
import {
  layer1LocalMatch,
  layer2Heuristics,
  layer3CloudAnalysis,
  NEEDS_DOM_REVIEW_REASON
} from "./securityEngine"

vi.mock("./aiAnalyzer", () => ({
  analyzeWithAI: vi.fn(),
  hasLocalModelConfig: vi.fn()
}))

vi.mock("../utils/cache", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../utils/cache")>()
  return {
    ...actual,
    getBlacklist: vi.fn(),
    getFromCache: vi.fn(),
    saveToCache: vi.fn(),
    getTenantActivation: vi.fn()
  }
})

const domContent: ExtractedDOMContent = {
  url: "https://fake-feishu.example/download",
  title: "飞书官方下载",
  metaDescription: "",
  h1Text: "飞书 Windows 客户端",
  buttonTexts: ["立即下载", "免费安装"],
  linkTexts: [],
  footerText: "",
  downloadKeywords: ["下载", "install"]
}

describe("securityEngine layers", () => {
  beforeEach(() => {
    vi.mocked(getBlacklist).mockResolvedValue([])
    vi.mocked(getFromCache).mockResolvedValue(null)
    vi.mocked(saveToCache).mockResolvedValue(undefined)
    vi.mocked(getTenantActivation).mockResolvedValue({
      activated: true,
      token: "test-token"
    })
    vi.mocked(hasLocalModelConfig).mockResolvedValue(false)
    vi.mocked(analyzeWithAI).mockReset()
  })

  describe("layer1LocalMatch", () => {
    it("allows search engines", async () => {
      const result = await layer1LocalMatch(
        "https://www.baidu.com/s?wd=飞书",
        TEST_DATASET
      )
      expect(result?.verdict).toBe("allow")
      expect(result?.layer).toBe("whitelist")
    })

    it("allows official domains", async () => {
      const result = await layer1LocalMatch(
        "https://www.feishu.cn/",
        TEST_DATASET
      )
      expect(result?.verdict).toBe("allow")
      expect(result?.matchedSoftware?.id).toBe("feishu")
    })

    it("blocks confirmed phishing domains", async () => {
      const result = await layer1LocalMatch(
        "https://evil-phish.example/login",
        TEST_DATASET
      )
      expect(result?.verdict).toBe("block")
      expect(result?.layer).toBe("blacklist")
    })

    it("blocks local blacklist entries", async () => {
      vi.mocked(getBlacklist).mockResolvedValueOnce(["blocked.example"])

      const result = await layer1LocalMatch(
        "https://sub.blocked.example/path",
        TEST_DATASET
      )

      expect(result?.verdict).toBe("block")
      expect(result?.reason).toContain("本地黑名单")
    })

    it("returns null when no fast match applies", async () => {
      const result = await layer1LocalMatch(
        "https://unknown-neutral.example/",
        TEST_DATASET
      )
      expect(result).toBeNull()
    })
  })

  describe("layer2Heuristics", () => {
    it("blocks brand typosquatting patterns immediately", async () => {
      const result = await layer2Heuristics(
        "https://fe1shu.cn/download",
        "飞书下载",
        TEST_POLICY,
        TEST_DATASET
      )

      expect(result.immediate?.verdict).toBe("block")
      expect(result.shouldEscalateToCloud).toBe(false)
    })

    it("allows out-of-scope pages with low confidence", async () => {
      const result = await layer2Heuristics(
        "https://neutral-blog.example/article",
        "Weekly news",
        TEST_POLICY,
        TEST_DATASET
      )

      expect(result.immediate?.verdict).toBe("allow")
      expect(result.immediate?.confidence).toBe(8)
      expect(result.reason).toBe("out-of-scope")
    })

    it("blocks domains similar to scoped official domains", async () => {
      const result = await layer2Heuristics(
        "https://feishu.co/download",
        "飞书客户端",
        TEST_POLICY,
        TEST_DATASET
      )

      expect(result.immediate?.verdict).toBe("block")
      expect(result.reason).toBe("similar-domain")
    })

    it("escalates to cloud when brand keywords and download intent align", async () => {
      const result = await layer2Heuristics(
        "https://fake-feishu.example/client",
        "飞书官方下载",
        TEST_POLICY,
        TEST_DATASET
      )

      expect(result.immediate).toBeUndefined()
      expect(result.shouldEscalateToCloud).toBe(true)
      expect(result.layerHint).toBe("keyword")
    })

    it("warns on brand hit without download intent", async () => {
      const result = await layer2Heuristics(
        "https://fake-feishu.example/about",
        "飞书产品介绍",
        TEST_POLICY,
        TEST_DATASET
      )

      expect(result.immediate?.verdict).toBe("warn")
      expect(result.immediate?.confidence).toBeGreaterThanOrEqual(
        TEST_POLICY.warningThreshold
      )
      expect(result.reason).toBe("brand-without-download-intent")
    })

    it("uses DOM button text as download intent", async () => {
      const result = await layer2Heuristics(
        "https://fake-feishu.example/about",
        "飞书产品介绍",
        TEST_POLICY,
        TEST_DATASET,
        {
          ...domContent,
          title: "飞书产品介绍",
          buttonTexts: ["个人版免费下载", "企业版免费试用"],
          downloadKeywords: ["下载", "免费"]
        }
      )

      expect(result.immediate).toBeUndefined()
      expect(result.shouldEscalateToCloud).toBe(true)
      expect(result.reason).toBe("keyword-triggered")
    })

    it("skips page-title-only brand signals under url_only policy", async () => {
      const result = await layer2Heuristics(
        "https://neutral-cdn.example/landing",
        "飞书官方下载",
        TEST_POLICY,
        TEST_DATASET
      )

      expect(result.immediate?.verdict).toBe("allow")
      expect(result.reason).toBe("out-of-scope")
    })

    it("scopes page-title brand signals when enterprise page_signals is enabled", async () => {
      const result = await layer2Heuristics(
        "https://neutral-cdn.example/landing",
        "飞书官方下载",
        TEST_POLICY_PAGE_SIGNALS,
        TEST_DATASET
      )

      expect(result.shouldEscalateToCloud).toBe(true)
      expect(result.layerHint).toBe("keyword")
    })

    it("requests page signals before allowing unknown URLs in page_signals mode", async () => {
      const result = await layer2Heuristics(
        "https://neutral-cdn.example/landing",
        undefined,
        TEST_POLICY_PAGE_SIGNALS,
        TEST_DATASET
      )

      expect(result.immediate).toBeUndefined()
      expect(result.reason).toBe("needs-page-signals")
    })
  })

  describe("layer3CloudAnalysis", () => {
    it("returns cached cloud decisions when available", async () => {
      vi.mocked(getFromCache).mockResolvedValueOnce({
        cacheKey: "cached",
        expiresAt: Date.now() + 60_000,
        result: {
          verdict: "block",
          confidence: 99,
          reason: "cached",
          layer: "cloud",
          timestamp: Date.now(),
          source: "cloud",
          datasetVersion: "cached-v1"
        }
      })

      const result = await layer3CloudAnalysis(
        domContent.url,
        domContent,
        "keyword",
        TEST_POLICY,
        TEST_DATASET
      )

      expect(result.verdict).toBe("block")
      expect(analyzeWithAI).not.toHaveBeenCalled()
    })

    it("persists successful cloud analysis", async () => {
      vi.mocked(analyzeWithAI).mockResolvedValueOnce({
        verdict: "block",
        confidence: 94,
        reason: "云模型判定钓鱼",
        matchedBrand: "飞书"
      })

      const result = await layer3CloudAnalysis(
        domContent.url,
        domContent,
        "keyword",
        TEST_POLICY,
        TEST_DATASET
      )

      expect(result.verdict).toBe("block")
      expect(result.source).toBe("cloud")
      expect(saveToCache).toHaveBeenCalledWith(domContent.url, result)
    })

    it("warns instead of calling cloud or local model when no model is configured", async () => {
      vi.mocked(getTenantActivation).mockResolvedValueOnce({
        activated: false
      })

      const result = await layer3CloudAnalysis(
        domContent.url,
        domContent,
        "keyword",
        TEST_POLICY,
        TEST_DATASET
      )

      expect(result.verdict).toBe("warn")
      expect(result.reason).toContain("本地规则提示风险")
      expect(analyzeWithAI).not.toHaveBeenCalled()
      expect(saveToCache).toHaveBeenCalled()
    })

    it("uses local model config without tenant activation", async () => {
      vi.mocked(getTenantActivation).mockResolvedValueOnce({
        activated: false
      })
      vi.mocked(hasLocalModelConfig).mockResolvedValueOnce(true)
      vi.mocked(analyzeWithAI).mockResolvedValueOnce({
        verdict: "block",
        confidence: 95,
        reason: "本地模型判定钓鱼",
        matchedBrand: "飞书"
      })

      const result = await layer3CloudAnalysis(
        domContent.url,
        domContent,
        "keyword",
        TEST_POLICY,
        TEST_DATASET
      )

      expect(result.verdict).toBe("block")
      expect(result.source).toBe("local")
      expect(analyzeWithAI).toHaveBeenCalled()
    })

    it("degrades gracefully when cloud analysis fails", async () => {
      vi.mocked(analyzeWithAI).mockRejectedValueOnce(new Error("timeout"))

      const result = await layer3CloudAnalysis(
        domContent.url,
        domContent,
        "keyword",
        TEST_POLICY,
        TEST_DATASET
      )

      expect(result.verdict).toBe("allow")
      expect(result.confidence).toBe(TEST_POLICY.warningThreshold - 5)
      expect(result.reason).toContain("云分析暂不可用")
      expect(saveToCache).toHaveBeenCalled()
    })
  })

  it("documents default allow path when DOM is missing", () => {
    expect(NEEDS_DOM_REVIEW_REASON).toContain("放行")
  })
})
