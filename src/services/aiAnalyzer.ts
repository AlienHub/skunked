import { AIAnalysisResponse, ExtractedDOMContent } from "../types"
import { OFFICIAL_SOFTWARE_REGISTRY } from "../data/officialRegistry"

// Default configuration (will be overridden by storage)
const AI_CONFIG = {
  provider: "openai" as "openai" | "anthropic",
  baseUrl: "https://api.openai.com/v1",
  model: "gpt-4o-mini",
  maxTokens: 500,
  temperature: 0.1
}

/**
 * Load AI configuration from storage
 */
async function loadAIConfig(): Promise<typeof AI_CONFIG & { apiKey: string }> {
  const storage = await chrome.storage.local.get([
    "aiProvider",
    "openaiApiKey",
    "anthropicApiKey",
    "baseUrl",
    "modelId"
  ])

  const provider = storage.aiProvider || "openai"
  const apiKey = provider === "anthropic"
    ? (storage.anthropicApiKey || "")
    : (storage.openaiApiKey || "")
  const baseUrl = storage.baseUrl || AI_CONFIG.baseUrl
  const model = storage.modelId || AI_CONFIG.model

  return {
    ...AI_CONFIG,
    provider,
    apiKey,
    baseUrl: baseUrl.replace(/\/$/, ""), // Remove trailing slash
    model
  }
}

/**
 * Extract software name from URL or content
 */
function inferTargetSoftware(domContent: ExtractedDOMContent): string | null {
  const allText = [
    domContent.url,
    domContent.title,
    domContent.h1Text
  ].join(" ").toLowerCase()

  // Try to match against known software
  for (const software of OFFICIAL_SOFTWARE_REGISTRY) {
    if (software.keywords.some((kw) => allText.includes(kw.toLowerCase()))) {
      return software.name
    }
  }

  return null
}

/**
 * Build AI prompt for phishing detection
 */
function buildPrompt(domContent: ExtractedDOMContent): string {
  const softwareName = inferTargetSoftware(domContent) || "未知软件"

  return `你是一个网络安全专家。请分析以下网页是否为钓鱼网站。

**当前访问的URL**: ${domContent.url}
**页面标题**: ${domContent.title}
**H1标题**: ${domContent.h1Text}
**页面描述**: ${domContent.metaDescription}
**下载按钮文本**: ${domContent.buttonTexts.join(", ") || "无"}
**页面关键词**: ${domContent.downloadKeywords.join(", ") || "无"}

**目标软件**: ${softwareName}

**钓鱼网站定义**:
钓鱼网站是指：假冒官方软件网站，诱导用户下载恶意软件或窃取用户信息的网站。

**判断标准**:
1. **域名检查**: 当前域名是否为该软件的官方域名？
   - 如果不是官方域名，但声称提供该软件下载，极大概率是钓鱼网站
   - 官方域名示例：
     * WPS: wps.cn, kingsoft.com
     * 飞书: feishu.cn, larksuite.com
     * 钉钉: dingtalk.com
     * 微信: weixin.qq.com, wechat.com
     * QQ: qq.com
     * 向日葵: oray.com

2. **冒充行为**: 页面是否使用官方品牌名称、Logo、声称"官方下载"等？

3. **诱导特征**: 是否存在"破解版"、"绿色版"、"免费VIP"、"高速下载"等诱导性词汇？

**判定逻辑**:
- 如果域名非官方，但页面标题/内容声称是该软件的下载页面 → 必定是钓鱼网站
- 如果域名高度相似（如 wps-download.com, feishu-vip.cn）→ 必定是钓鱼网站
- 置信度应反映判定的确定性，80%以上应为高置信度

**输出要求**:
请以JSON格式输出，格式如下：
{
  "is_phishing": true/false,
  "confidence": 0-100的数字,
  "reason": "简短判断理由（中文）",
  "suspicious_elements": ["可疑元素1", "可疑元素2"]
}

**重要**:
- is_phishing 为 true 表示这是钓鱼网站，需要拦截
- is_phishing 为 false 表示这是安全的官方网站
- 如果域名不是官方域名但提供软件下载，is_phishing 必须为 true
- 置信度80%以上表示高度确定

只输出JSON，不要包含其他文字。`
}

/**
 * Call OpenAI-compatible API
 */
async function callOpenAI(prompt: string, config: Awaited<ReturnType<typeof loadAIConfig>>): Promise<AIAnalysisResponse> {
  if (!config.apiKey) {
    throw new Error("API key not configured")
  }

  const url = `${config.baseUrl}/chat/completions`
  console.log("🌐 [API调用] URL:", url)
  console.log("🌐 [API调用] Model:", config.model)

  const requestBody = {
    model: config.model,
    messages: [
      {
        role: "system",
        content: "你是一个网络安全专家，专门识别钓鱼网站。"
      },
      {
        role: "user",
        content: prompt
      }
    ],
    max_tokens: config.maxTokens,
    temperature: config.temperature
  }

  console.log("📤 [API调用] Request Body:", JSON.stringify(requestBody, null, 2))

  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${config.apiKey}`
    },
    body: JSON.stringify(requestBody)
  })

  console.log("📥 [API调用] Response Status:", response.status, response.statusText)

  if (!response.ok) {
    const errorText = await response.text()
    console.error("❌ [API调用] Error Response:", errorText)
    throw new Error(`API error: ${response.status} - ${errorText}`)
  }

  const data = await response.json()
  console.log("📦 [API调用] Response Data:", JSON.stringify(data, null, 2))

  const content = data.choices[0].message.content
  console.log("💬 [API调用] Response Content:", content)

  // Parse JSON response
  try {
    const parsed = JSON.parse(content)
    console.log("✅ [API调用] 解析成功:", parsed)
    return parsed
  } catch (e) {
    console.error("❌ [API调用] JSON 解析失败:", content)
    throw new Error(`Failed to parse AI response: ${content}`)
  }
}

/**
 * Call Anthropic Claude API
 */
async function callAnthropic(prompt: string, config: Awaited<ReturnType<typeof loadAIConfig>>): Promise<AIAnalysisResponse> {
  if (!config.apiKey) {
    throw new Error("API key not configured")
  }

  const response = await fetch(`${config.baseUrl}/v1/messages`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": config.apiKey,
      "anthropic-version": "2023-06-01"
    },
    body: JSON.stringify({
      model: config.model,
      max_tokens: config.maxTokens,
      messages: [
        {
          role: "user",
          content: prompt
        }
      ]
    })
  })

  if (!response.ok) {
    const errorText = await response.text()
    throw new Error(`API error: ${response.status} - ${errorText}`)
  }

  const data = await response.json()
  const content = data.content[0].text

  // Parse JSON response
  try {
    return JSON.parse(content)
  } catch (e) {
    throw new Error(`Failed to parse AI response: ${content}`)
  }
}

/**
 * Main function: Analyze page with AI
 */
export async function analyzeWithAI(
  url: string,
  domContent: ExtractedDOMContent
): Promise<AIAnalysisResponse> {
  console.log("🤖 [AI分析] 开始 AI 语义分析")
  console.log("📍 目标 URL:", url)

  // Check if AI is enabled (from storage)
  const storage = await chrome.storage.local.get("settings")
  if (!storage.settings?.enableAI) {
    console.log("⚠️ [AI分析] AI 功能已禁用")
    return {
      isPhishing: true,
      confidence: 70,
      reason: "AI分析已禁用，保守判定为可疑",
      suspiciousElements: []
    }
  }

  // Load AI configuration from storage
  const config = await loadAIConfig()
  console.log("🔧 [AI配置] Provider:", config.provider)
  console.log("🔧 [AI配置] Base URL:", config.baseUrl)
  console.log("🔧 [AI配置] Model:", config.model)
  console.log("🔧 [AI配置] API Key:", config.apiKey ? `${config.apiKey.substring(0, 10)}...` : "未配置")

  if (!config.apiKey) {
    console.warn("❌ [AI分析] API 密钥未配置，跳过分析")
    return {
      isPhishing: true,
      confidence: 60,
      reason: "AI API密钥未配置，保守判定为可疑",
      suspiciousElements: []
    }
  }

  const prompt = buildPrompt(domContent)
  console.log("📝 [AI分析] Prompt 长度:", prompt.length, "字符")

  try {
    console.log("🚀 [AI分析] 正在调用 AI API...")
    const startTime = Date.now()

    let result: AIAnalysisResponse
    if (config.provider === "openai") {
      result = await callOpenAI(prompt, config)
    } else if (config.provider === "anthropic") {
      result = await callAnthropic(prompt, config)
    } else {
      throw new Error(`Unsupported AI provider: ${config.provider}`)
    }

    const duration = Date.now() - startTime
    console.log(`✅ [AI分析] API 调用成功！耗时: ${duration}ms`)
    console.log("📊 [AI分析] 原始结果:", result)

    // 后处理：检查 AI 返回是否矛盾
    // 如果 is_phishing 是 false 但置信度很高（>75%），需要重新判定
    if (!result.isPhishing && result.confidence > 75) {
      console.warn("⚠️ [AI分析] 检测到矛盾结果：AI 说不是钓鱼但置信度很高")
      console.warn("⚠️ [AI分析] 置信度:", result.confidence + "%")
      console.warn("⚠️ [AI分析] 判定依据:", result.reason)

      // 检查判定依据中是否包含钓鱼特征的关键词
      const suspiciousKeywords = ["冒充", "假冒", "非官方", "钓鱼", "误导", "诱导", "相似", "混淆"]
      const hasSuspiciousKeyword = suspiciousKeywords.some(kw =>
        result.reason.includes(kw) || (result.suspiciousElements && result.suspiciousElements.some((el: string) => el.includes(kw)))
      )

      if (hasSuspiciousKeyword) {
        console.warn("🔧 [AI分析] 修正判定：检测到可疑关键词，重新标记为钓鱼网站")
        result.isPhishing = true
        result.reason += "（已自动修正）"
      }
    }

    console.log("📊 [AI分析] 最终结果:", result)
    return result
  } catch (error) {
    console.error("❌ [AI分析] API 调用失败:", error)
    // Fallback: conservative approach
    return {
      isPhishing: true,
      confidence: 60,
      reason: `AI分析失败: ${error instanceof Error ? error.message : "未知错误"}`,
      suspiciousElements: []
    }
  }
}
