import "./options.css"

import { useEffect, useState } from "react"

interface RuntimeInfo {
  datasetVersion?: string
}

type ModelPresetId = "deepseek" | "kimi" | "glm" | "minimax" | "custom"

interface ModelConfig {
  enabled: boolean
  preset: ModelPresetId
  apiKey: string
  baseUrl: string
  modelId: string
}

const MODEL_PRESETS: Record<
  ModelPresetId,
  {
    label: string
    baseUrl: string
    modelId: string
  }
> = {
  deepseek: {
    label: "DeepSeek",
    baseUrl: "https://api.deepseek.com/v1",
    modelId: "deepseek-chat"
  },
  kimi: {
    label: "Kimi",
    baseUrl: "https://api.moonshot.cn/v1",
    modelId: "moonshot-v1-8k"
  },
  glm: {
    label: "GLM",
    baseUrl: "https://open.bigmodel.cn/api/paas/v4",
    modelId: "glm-4-flash"
  },
  minimax: {
    label: "MiniMax",
    baseUrl: "https://api.minimax.io/v1",
    modelId: "MiniMax-M1"
  },
  custom: {
    label: "自定义",
    baseUrl: "https://api.openai.com/v1",
    modelId: "gpt-4o-mini"
  }
}

const MODEL_PRESET_ORDER = Object.keys(MODEL_PRESETS) as ModelPresetId[]

function inferPreset(baseUrl?: string): ModelPresetId {
  if (!baseUrl) return "deepseek"
  const normalized = baseUrl.replace(/\/$/, "")
  const matchedPreset = MODEL_PRESET_ORDER.find(
    (preset) => MODEL_PRESETS[preset].baseUrl.replace(/\/$/, "") === normalized
  )

  return matchedPreset || "custom"
}

function getLocalStorage(keys: string | string[]) {
  return new Promise<Record<string, any>>((resolve) => {
    chrome.storage.local.get(keys, resolve)
  })
}

function setLocalStorage(items: Record<string, any>) {
  return new Promise<void>((resolve) => {
    chrome.storage.local.set(items, resolve)
  })
}

function IndexOptions() {
  const [runtimeInfo, setRuntimeInfo] = useState<RuntimeInfo>({})
  const [modelConfig, setModelConfig] = useState<ModelConfig>({
    enabled: false,
    preset: "deepseek",
    apiKey: "",
    baseUrl: MODEL_PRESETS.deepseek.baseUrl,
    modelId: MODEL_PRESETS.deepseek.modelId
  })
  const [busy, setBusy] = useState(false)
  const [modelBusy, setModelBusy] = useState(false)
  const [message, setMessage] = useState("")
  const [modelMessage, setModelMessage] = useState("")

  const load = () => {
    chrome.runtime.sendMessage({ action: "get_runtime_info" }, (response) => {
      if (response?.success) {
        setRuntimeInfo(response.data)
      }
    })

    getLocalStorage([
      "settings",
      "aiProvider",
      "openaiApiKey",
      "baseUrl",
      "modelId",
      "modelPreset"
    ]).then((storage) => {
      const preset =
        storage.modelPreset && MODEL_PRESETS[storage.modelPreset]
          ? storage.modelPreset
          : inferPreset(storage.baseUrl)
      const presetConfig = MODEL_PRESETS[preset]
      const apiKey = storage.openaiApiKey || ""

      setModelConfig({
        enabled: Boolean(storage.settings?.enableAI && apiKey),
        preset,
        apiKey,
        baseUrl: storage.baseUrl || presetConfig.baseUrl,
        modelId: storage.modelId || presetConfig.modelId
      })
    })
  }

  useEffect(() => {
    load()
  }, [])

  const syncOpenDataset = () => {
    setBusy(true)
    setMessage("")
    chrome.runtime.sendMessage({ action: "sync_open_dataset" }, (response) => {
      setBusy(false)
      if (response?.success) {
        setMessage("防护名单已更新")
        load()
      } else {
        setMessage(response?.error || "更新失败，请稍后重试")
      }
    })
  }

  const selectModelPreset = (preset: ModelPresetId) => {
    const presetConfig = MODEL_PRESETS[preset]
    setModelMessage("")
    setModelConfig((current) => ({
      ...current,
      preset,
      baseUrl: preset === "custom" ? current.baseUrl : presetConfig.baseUrl,
      modelId: preset === "custom" ? current.modelId : presetConfig.modelId
    }))
  }

  const saveModelConfig = async () => {
    setModelBusy(true)
    setModelMessage("")

    try {
      const apiKey = modelConfig.apiKey.trim()
      const baseUrl = modelConfig.baseUrl.trim().replace(/\/$/, "")
      const modelId = modelConfig.modelId.trim()
      const storage = await getLocalStorage("settings")
      const settings = {
        warningThreshold: 60,
        blockThreshold: 90,
        cacheExpiry: 86400000,
        ...storage.settings,
        enableAI: modelConfig.enabled && Boolean(apiKey)
      }

      await setLocalStorage({
        settings,
        aiProvider: "openai",
        openaiApiKey: apiKey,
        baseUrl,
        modelId,
        modelPreset: modelConfig.preset
      })

      setModelConfig((current) => ({
        ...current,
        enabled: settings.enableAI,
        apiKey,
        baseUrl,
        modelId
      }))
      setModelMessage(
        settings.enableAI
          ? "大模型辅助识别已开启"
          : "配置已保存，暂未启用大模型辅助识别"
      )
    } catch (error) {
      setModelMessage(
        error instanceof Error ? error.message : "保存失败，请稍后重试"
      )
    } finally {
      setModelBusy(false)
    }
  }

  return (
    <main className="options-root">
      <header className="settings-header">
        <div className="brand-mark" aria-hidden="true">
          KJ
        </div>
        <div>
          <span className="eyebrow">防护已开启</span>
          <h1>空军设置</h1>
          <p>这里不需要复杂配置。保持开启即可自动识别可疑下载页。</p>
        </div>
      </header>

      <section className="hero-panel">
        <div>
          <h2>正在保护你的浏览器</h2>
          <p>
            空军会在你访问疑似假官网、钓鱼下载页或高仿域名时提醒你，并优先引导前往官方站点。
          </p>
        </div>
        <span>已启用</span>
      </section>

      <section className="quick-grid">
        <section className="panel">
          <div className="panel-heading">
            <h2>保护内容</h2>
          </div>
          <div className="feature-list">
            <div>
              <strong>假官网识别</strong>
              <span>发现冒充办公软件、远控软件的下载页面。</span>
            </div>
            <div>
              <strong>可疑域名提醒</strong>
              <span>检查高仿域名、诱导下载和异常后缀。</span>
            </div>
            <div>
              <strong>官方入口引导</strong>
              <span>风险页面会提供官方站点入口，减少误点。</span>
            </div>
          </div>
        </section>

        <section className="panel">
          <div className="panel-heading">
            <h2>防护名单</h2>
            <span>{runtimeInfo.datasetVersion ? "可用" : "本地可用"}</span>
          </div>
          <p className="caption">
            防护名单包含受保护品牌、官方域名和已确认风险域名。离线时仍会使用本地名单继续防护。
          </p>
          <button
            className="primary-action"
            onClick={syncOpenDataset}
            disabled={busy}
          >
            {busy ? "更新中..." : "更新防护名单"}
          </button>
          {message ? <p className="feedback">{message}</p> : null}
        </section>
      </section>

      <details className="panel advanced-panel">
        <summary>
          <span>
            <strong>大模型辅助识别</strong>
            <small>可选增强，需要你自己的 API Key</small>
          </span>
          <em>
            {modelConfig.enabled && modelConfig.apiKey ? "已启用" : "未启用"}
          </em>
        </summary>

        <div className="model-form">
          <label className="switch-row">
            <input
              type="checkbox"
              checked={modelConfig.enabled}
              onChange={(event) =>
                setModelConfig((current) => ({
                  ...current,
                  enabled: event.target.checked
                }))
              }
            />
            <span>
              <strong>使用大模型辅助判断不明确页面</strong>
              <small>未配置时仍会使用本地规则和防护名单。</small>
            </span>
          </label>

          <div className="preset-row" aria-label="模型服务商">
            {MODEL_PRESET_ORDER.map((preset) => (
              <button
                key={preset}
                type="button"
                className={modelConfig.preset === preset ? "selected" : ""}
                onClick={() => selectModelPreset(preset)}
              >
                {MODEL_PRESETS[preset].label}
              </button>
            ))}
          </div>

          <div className="form-grid">
            <label>
              <span>API Key</span>
              <input
                type="password"
                value={modelConfig.apiKey}
                placeholder="粘贴你的平台 API Key"
                onChange={(event) =>
                  setModelConfig((current) => ({
                    ...current,
                    apiKey: event.target.value
                  }))
                }
              />
            </label>

            <label>
              <span>API 地址</span>
              <input
                type="url"
                value={modelConfig.baseUrl}
                onChange={(event) =>
                  setModelConfig((current) => ({
                    ...current,
                    baseUrl: event.target.value
                  }))
                }
              />
            </label>

            <label>
              <span>模型名称</span>
              <input
                type="text"
                value={modelConfig.modelId}
                onChange={(event) =>
                  setModelConfig((current) => ({
                    ...current,
                    modelId: event.target.value
                  }))
                }
              />
            </label>
          </div>

          <div className="form-footer">
            <p>
              Key
              只保存在本机浏览器扩展存储中。不同平台模型名可能调整，可按控制台中的最新名称修改。
            </p>
            <button
              className="secondary-action"
              onClick={saveModelConfig}
              disabled={modelBusy}
            >
              {modelBusy ? "保存中..." : "保存配置"}
            </button>
          </div>

          {modelMessage ? <p className="feedback">{modelMessage}</p> : null}
        </div>
      </details>

      <section className="panel policy-note">
        <h2>遇到风险页面时</h2>
        <div className="note-grid">
          <p>高风险页面会被阻断。</p>
          <p>中等风险页面会显示提醒。</p>
          <p>你可以选择继续访问，但建议优先去官网。</p>
          <p>关闭提醒不会关闭整体防护。</p>
        </div>
      </section>
    </main>
  )
}

export default IndexOptions
