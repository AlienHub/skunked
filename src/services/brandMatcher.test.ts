import { describe, expect, it } from "vitest"

import { TEST_FEISHU_APP } from "../test/fixtures"
import { matchBrandFromSignals } from "./brandMatcher"

describe("brandMatcher", () => {
  it("returns no match when signals are too weak", () => {
    const result = matchBrandFromSignals(
      {
        url: "https://random-blog.example/post",
        title: "Weekly update"
      },
      [TEST_FEISHU_APP]
    )

    expect(result.software).toBeUndefined()
    expect(result.score).toBeLessThanOrEqual(1)
  })

  it("prefers official domain and brand keywords", () => {
    const result = matchBrandFromSignals(
      {
        url: "https://www.feishu.cn/download",
        title: "飞书客户端下载",
        h1Text: "立即安装飞书",
        buttonTexts: ["Windows 下载", "Mac 下载"]
      },
      [TEST_FEISHU_APP]
    )

    expect(result.software?.id).toBe("feishu")
    expect(result.score).toBeGreaterThan(1)
  })

  it("scores keyword hits without official domain", () => {
    const result = matchBrandFromSignals(
      {
        url: "https://fake-feishu.example/",
        title: "飞书 lark 下载",
        buttonTexts: ["立即下载"]
      },
      [TEST_FEISHU_APP]
    )

    expect(result.software?.id).toBe("feishu")
    expect(result.score).toBeGreaterThan(1)
  })
})
