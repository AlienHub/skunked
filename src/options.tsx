import { useEffect, useState } from "react"
import "./options.css"

interface AIConfig {
  provider: "openai" | "anthropic"
  apiKey: string
  baseUrl: string
  model: string
}

interface Settings {
  enableAI: boolean
  warningThreshold: number
  blockThreshold: number
}

function IndexOptions() {
  const [config, setConfig] = useState<AIConfig>({
    provider: "openai",
    apiKey: "",
    baseUrl: "https://api.openai.com/v1",
    model: "gpt-4o-mini"
  })

  const [settings, setSettings] = useState<Settings>({
    enableAI: true,
    warningThreshold: 60,
    blockThreshold: 90
  })

  const [saved, setSaved] = useState(false)
  const [testing, setTesting] = useState(false)
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null)

  // Load saved config on mount
  useEffect(() => {
    chrome.storage.local.get(
      ["aiProvider", "openaiApiKey", "anthropicApiKey", "baseUrl", "modelId", "settings"],
      (data) => {
        if (data.aiProvider) {
          setConfig((prev) => ({ ...prev, provider: data.aiProvider }))
        }
        const apiKey = data.aiProvider === "anthropic" ? data.anthropicApiKey : data.openaiApiKey
        if (apiKey) {
          setConfig((prev) => ({ ...prev, apiKey }))
        }
        if (data.baseUrl) {
          setConfig((prev) => ({ ...prev, baseUrl: data.baseUrl }))
        }
        if (data.modelId) {
          setConfig((prev) => ({ ...prev, model: data.modelId }))
        }
        if (data.settings) {
          setSettings(data.settings)
        }
      }
    )
  }, [])

  const handleSave = async () => {
    const storageData: any = {
      aiProvider: config.provider,
      baseUrl: config.baseUrl,
      modelId: config.model,
      settings
    }

    if (config.provider === "openai") {
      storageData.openaiApiKey = config.apiKey
    } else {
      storageData.anthropicApiKey = config.apiKey
    }

    await chrome.storage.local.set(storageData)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  const handleTest = async () => {
    setTesting(true)
    setTestResult(null)

    try {
      const url = config.baseUrl.replace(/\/$/, "") + "/chat/completions"
      const response = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${config.apiKey}`
        },
        body: JSON.stringify({
          model: config.model,
          messages: [
            {
              role: "user",
              content: "测试连接"
            }
          ],
          max_tokens: 10
        })
      })

      if (response.ok) {
        setTestResult({ success: true, message: "✅ 连接成功！API 配置有效" })
      } else {
        const error = await response.text()
        setTestResult({ success: false, message: `❌ 连接失败: ${response.status} - ${error.substring(0, 100)}` })
      }
    } catch (error: any) {
      setTestResult({ success: false, message: `❌ 连接失败: ${error.message}` })
    } finally {
      setTesting(false)
    }
  }

  const presets = [
    {
      name: "OpenAI 官方",
      baseUrl: "https://api.openai.com/v1",
      model: "gpt-4o-mini"
    },
    {
      name: "Azure OpenAI",
      baseUrl: "https://your-resource.openai.azure.com/openai/deployments/your-deployment",
      model: "gpt-4o"
    },
    {
      name: "Anthropic",
      baseUrl: "https://api.anthropic.com",
      model: "claude-3-haiku-20240307"
    },
    {
      name: "DeepSeek",
      baseUrl: "https://api.deepseek.com/v1",
      model: "deepseek-chat"
    },
    {
      name: "通义千问",
      baseUrl: "https://dashscope.aliyuncs.com/compatible-mode/v1",
      model: "qwen-plus"
    },
    {
      name: "智谱 AI",
      baseUrl: "https://open.bigmodel.cn/api/paas/v4",
      model: "glm-4-flash"
    },
    {
      name: "Moonshot (Kimi)",
      baseUrl: "https://api.moonshot.cn/v1",
      model: "moonshot-v1-8k"
    }
  ]

  const applyPreset = (preset: typeof presets[0]) => {
    setConfig((prev) => ({
      ...prev,
      baseUrl: preset.baseUrl,
      model: preset.model
    }))
  }

  return (
    <div className="options-container">
      <div className="options-content">
        <h1>⚙️ 空军 - 反钓鱼卫士配置</h1>

        <section className="config-section">
          <h2>🤖 AI 配置</h2>

          <div className="form-group">
            <label>API 提供商</label>
            <select
              value={config.provider}
              onChange={(e) => setConfig({ ...config, provider: e.target.value as "openai" | "anthropic" })}
            >
              <option value="openai">OpenAI 兼容接口</option>
              <option value="anthropic">Anthropic Claude</option>
            </select>
          </div>

          <div className="form-group">
            <label>API Key *</label>
            <input
              type="password"
              value={config.apiKey}
              onChange={(e) => setConfig({ ...config, apiKey: e.target.value })}
              placeholder="sk-..."
            />
            <small>您的 API 密钥将只存储在本地浏览器中</small>
          </div>

          <div className="form-group">
            <label>Base URL *</label>
            <input
              type="text"
              value={config.baseUrl}
              onChange={(e) => setConfig({ ...config, baseUrl: e.target.value })}
              placeholder="https://api.openai.com/v1"
            />
            <small>API 服务的基础 URL</small>
          </div>

          <div className="form-group">
            <label>模型 ID *</label>
            <input
              type="text"
              value={config.model}
              onChange={(e) => setConfig({ ...config, model: e.target.value })}
              placeholder="gpt-4o-mini"
            />
            <small>要使用的模型名称</small>
          </div>

          <div className="form-group">
            <label>快速预设</label>
            <div className="presets">
              {presets.map((preset) => (
                <button
                  key={preset.name}
                  className="preset-btn"
                  onClick={() => applyPreset(preset)}
                >
                  {preset.name}
                </button>
              ))}
            </div>
          </div>

          <div className="button-group">
            <button className="btn btn-primary" onClick={handleSave}>
              💾 保存配置
            </button>
            <button
              className="btn btn-secondary"
              onClick={handleTest}
              disabled={!config.apiKey || !config.baseUrl || testing}
            >
              {testing ? "🔄 测试中..." : "🧪 测试连接"}
            </button>
          </div>

          {saved && <div className="success-message">✅ 配置已保存！</div>}
          {testResult && (
            <div className={`test-result ${testResult.success ? "success" : "error"}`}>
              {testResult.message}
            </div>
          )}
        </section>

        <section className="config-section">
          <h2>🎯 检测阈值</h2>

          <div className="form-group">
            <label>警告阈值: {settings.warningThreshold}%</label>
            <input
              type="range"
              min="0"
              max="100"
              value={settings.warningThreshold}
              onChange={(e) => setSettings({ ...settings, warningThreshold: Number(e.target.value) })}
              className="slider"
            />
            <small>
              置信度达到此值时显示黄色警告栏（建议：60%）
            </small>
          </div>

          <div className="form-group">
            <label>拦截阈值: {settings.blockThreshold}%</label>
            <input
              type="range"
              min="0"
              max="100"
              value={settings.blockThreshold}
              onChange={(e) => setSettings({ ...settings, blockThreshold: Number(e.target.value) })}
              className="slider"
            />
            <small>
              置信度达到此值时显示红色全屏拦截（建议：90%）
            </small>
          </div>

          <div className="form-group checkbox-group">
            <label className="checkbox-label">
              <input
                type="checkbox"
                checked={settings.enableAI}
                onChange={(e) => setSettings({ ...settings, enableAI: e.target.checked })}
              />
              <span>启用 AI 语义分析</span>
            </label>
            <small>
              关闭后将仅使用本地匹配和启发式分析，可能降低检测准确率
            </small>
          </div>

          <button className="btn btn-primary" onClick={handleSave}>
            💾 保存阈值设置
          </button>
        </section>

        <section className="config-section info-section">
          <h2>📖 使用说明</h2>
          <ol>
            <li>
              <strong>选择 API 提供商</strong>：大多数第三方服务商都兼容 OpenAI 接口，选择
              "OpenAI 兼容接口"
            </li>
            <li>
              <strong>输入 API Key</strong>：从你的服务商获取 API 密钥
            </li>
            <li>
              <strong>配置 Base URL</strong>：输入服务商的 API 地址，可以从快速预设中选择
            </li>
            <li>
              <strong>设置模型 ID</strong>：输入你要使用的模型名称
            </li>
            <li>
              <strong>测试连接</strong>：点击"测试连接"按钮验证配置是否正确
            </li>
            <li>
              <strong>保存配置</strong>：点击"保存配置"按钮应用设置
            </li>
          </ol>

          <h3>推荐的第三方服务商：</h3>
          <ul>
            <li>
              <strong>DeepSeek</strong> -
              <a href="https://platform.deepseek.com" target="_blank" rel="noopener">
                https://platform.deepseek.com
              </a>
              {" "}（性价比高，支持长文本）
            </li>
            <li>
              <strong>通义千问</strong> -
              <a href="https://dashscope.aliyuncs.com" target="_blank" rel="noopener">
                https://dashscope.aliyuncs.com
              </a>
              {" "}（阿里云，稳定可靠）
            </li>
            <li>
              <strong>智谱 AI</strong> -
              <a href="https://open.bigmodel.cn" target="_blank" rel="noopener">
                https://open.bigmodel.cn
              </a>
              {" "}（国产大模型，有免费额度）
            </li>
          </ul>
        </section>
      </div>
    </div>
  )
}

export default IndexOptions
