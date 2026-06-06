export interface FallbackAnalyzeInput {
  host: string
  title: string
  buttonTexts: string[]
}

export interface FallbackAnalyzeResult {
  verdict: "allow" | "warn" | "block"
  confidence: number
  reason: string
}

export function fallbackAnalyze(
  input: FallbackAnalyzeInput
): FallbackAnalyzeResult {
  const textBlob = `${input.host} ${input.title} ${input.buttonTexts.join(" ")}`.toLowerCase()
  const suspiciousWords = [
    "下载",
    "download",
    "安装",
    "setup",
    "官方",
    "极速",
    "破解版",
    "vip"
  ]
  const hitCount = suspiciousWords.reduce((count, word) => {
    return count + (textBlob.includes(word) ? 1 : 0)
  }, 0)

  if (hitCount >= 4) {
    return {
      verdict: "block",
      confidence: 92,
      reason: "页面存在高密度下载诱导词与冒充特征"
    }
  }

  if (hitCount >= 2) {
    return {
      verdict: "warn",
      confidence: 72,
      reason: "页面存在可疑下载诱导词，建议谨慎访问"
    }
  }

  return {
    verdict: "allow",
    confidence: 20,
    reason: "未发现明显钓鱼特征"
  }
}
