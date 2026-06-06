import { describe, expect, it } from "vitest"

import { fallbackAnalyze } from "./fallbackAnalyze"

describe("fallbackAnalyze", () => {
  it("allows pages with few suspicious words", () => {
    const result = fallbackAnalyze({
      host: "safe.example",
      title: "产品介绍",
      buttonTexts: ["了解更多"]
    })

    expect(result.verdict).toBe("allow")
    expect(result.confidence).toBe(20)
  })

  it("warns when multiple suspicious words appear", () => {
    const result = fallbackAnalyze({
      host: "warn.example",
      title: "官方下载",
      buttonTexts: ["立即安装"]
    })

    expect(result.verdict).toBe("warn")
    expect(result.confidence).toBe(72)
  })

  it("blocks high-density download bait language", () => {
    const result = fallbackAnalyze({
      host: "evil.example",
      title: "官方极速下载 破解版",
      buttonTexts: ["VIP 安装", "download setup"]
    })

    expect(result.verdict).toBe("block")
    expect(result.confidence).toBe(92)
    expect(result.reason).toContain("高密度")
  })
})
