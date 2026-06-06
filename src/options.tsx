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

function isModelPresetId(value: unknown): value is ModelPresetId {
  return typeof value === "string" && value in MODEL_PRESETS
}

function getStorage(keys: string[]) {
  return new Promise<Record<string, any>>((resolve) => {
    chrome.storage.local.get(keys, resolve)
  })
}

function setStorage(items: Record<string, any>) {
  return new Promise<void>((resolve) => {
    chrome.storage.local.set(items, resolve)
  })
}

function inferPreset(baseUrl?: string): ModelPresetId {
  if (!baseUrl) return "deepseek"
  const normalized = baseUrl.replace(/\/$/, "")
  return (
    MODEL_PRESET_ORDER.find(
      (preset) =>
        MODEL_PRESETS[preset].baseUrl.replace(/\/$/, "") === normalized
    ) || "custom"
  )
}

function defaultModelConfig(): ModelConfig {
  return {
    enabled: false,
    preset: "deepseek",
    apiKey: "",
    baseUrl: MODEL_PRESETS.deepseek.baseUrl,
    modelId: MODEL_PRESETS.deepseek.modelId
  }
}

function parseModelIds(payload: any): string[] {
  const candidates = Array.isArray(payload?.data)
    ? payload.data
    : Array.isArray(payload?.models)
      ? payload.models
      : Array.isArray(payload)
        ? payload
        : []

  return candidates
    .map((item: any) =>
      typeof item === "string" ? item : String(item?.id || item?.name || "")
    )
    .map((item: string) => item.trim())
    .filter(Boolean)
}

function IndexOptions() {
  const [runtimeInfo, setRuntimeInfo] = useState<RuntimeInfo>({})
  const [modelConfig, setModelConfig] =
    useState<ModelConfig>(defaultModelConfig())
  const [modelOptions, setModelOptions] = useState<string[]>([])
  const [busy, setBusy] = useState(false)
  const [modelBusy, setModelBusy] = useState(false)
  const [modelListBusy, setModelListBusy] = useState(false)
  const [message, setMessage] = useState("")
  const [modelMessage, setModelMessage] = useState("")

  const load = () => {
    chrome.runtime.sendMessage({ action: "get_runtime_info" }, (response) => {
      if (response?.success) {
        setRuntimeInfo(response.data)
      }
    })

    getStorage([
      "localModelConfig",
      "openaiApiKey",
      "baseUrl",
      "modelId",
      "modelPreset"
    ]).then((storage) => {
      const stored = storage.localModelConfig || {}
      const baseUrl = stored.baseUrl || storage.baseUrl
      const preset: ModelPresetId = isModelPresetId(stored.preset)
        ? stored.preset
        : inferPreset(baseUrl)
      const presetConfig = MODEL_PRESETS[preset]

      setModelConfig({
        enabled: Boolean(stored.enabled),
        preset,
        apiKey: stored.apiKey || storage.openaiApiKey || "",
        baseUrl: baseUrl || presetConfig.baseUrl,
        modelId: stored.modelId || storage.modelId || presetConfig.modelId
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
    setModelOptions([])
    setModelConfig((current) => ({
      ...current,
      preset,
      baseUrl: preset === "custom" ? current.baseUrl : presetConfig.baseUrl,
      modelId: preset === "custom" ? current.modelId : presetConfig.modelId
    }))
  }

  const fetchModelOptions = async () => {
    const apiKey = modelConfig.apiKey.trim()
    const baseUrl = modelConfig.baseUrl.trim().replace(/\/$/, "")

    if (!apiKey || !baseUrl) {
      setModelMessage("请先填写 API Key 和 API 地址")
      return
    }

    setModelListBusy(true)
    setModelMessage("")

    try {
      const response = await fetch(`${baseUrl}/models`, {
        method: "GET",
        headers: {
          Authorization: `Bearer ${apiKey}`
        }
      })

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`)
      }

      const data = await response.json()
      const ids = parseModelIds(data)

      if (!ids.length) {
        throw new Error("接口未返回可用模型")
      }

      setModelOptions(ids)
      setModelConfig((current) => ({
        ...current,
        modelId: ids.includes(current.modelId) ? current.modelId : ids[0]
      }))
      setModelMessage(`已获取 ${ids.length} 个模型`)
    } catch (error) {
      setModelOptions([])
      setModelMessage(
        `无法获取模型列表，可手动填写模型名称（${
          error instanceof Error ? error.message : "未知错误"
        }）`
      )
    } finally {
      setModelListBusy(false)
    }
  }

  const saveModelConfig = async () => {
    setModelBusy(true)
    setModelMessage("")

    try {
      const apiKey = modelConfig.apiKey.trim()
      const baseUrl = modelConfig.baseUrl.trim().replace(/\/$/, "")
      const modelId = modelConfig.modelId.trim()
      const enabled =
        modelConfig.enabled && Boolean(apiKey && baseUrl && modelId)

      await setStorage({
        localModelConfig: {
          enabled,
          preset: modelConfig.preset,
          apiKey,
          baseUrl,
          modelId
        },
        // Keep legacy keys for older builds during extension updates.
        openaiApiKey: apiKey,
        baseUrl,
        modelId,
        modelPreset: modelConfig.preset
      })

      setModelConfig((current) => ({
        ...current,
        enabled,
        apiKey,
        baseUrl,
        modelId
      }))
      setModelMessage(
        enabled ? "大模型辅助识别已开启" : "配置已保存，当前未启用"
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
          SK
        </div>
        <div>
          <span className="eyebrow">防护已开启</span>
          <h1>SKUNKED 设置</h1>
          <p>保持开启即可识别可疑下载页、假官网和高仿域名。</p>
        </div>
      </header>

      <section className="hero-panel">
        <div>
          <h2>正在保护你的浏览器</h2>
          <p>
            访问疑似钓鱼页面时，SKUNKED 会提醒或阻断，并提供对应品牌的官方入口。
          </p>
        </div>
        <span>{runtimeInfo.datasetVersion || "fallback-local-v1"}</span>
      </section>

      <section className="quick-grid">
        <section className="panel">
          <div className="panel-heading">
            <h2>保护内容</h2>
          </div>
          <div className="feature-list">
            <div>
              <strong>假官网识别</strong>
              <span>检查冒充办公、通信、远控等软件的下载页面。</span>
            </div>
            <div>
              <strong>可疑域名提醒</strong>
              <span>识别高仿域名、诱导下载词和异常域名模式。</span>
            </div>
            <div>
              <strong>官方入口引导</strong>
              <span>风险页面会优先引导前往真实官方站点。</span>
            </div>
          </div>
        </section>

        <section className="panel">
          <div className="panel-heading">
            <h2>防护名单</h2>
            <span>可手动更新</span>
          </div>
          <p className="caption">
            防护名单包含受保护品牌、官方域名和已确认风险域名。离线时继续使用本地名单。
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
            <small>可选增强，使用你自己的 API Key</small>
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
              <small>未启用时仍会使用本地规则和防护名单。</small>
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
                placeholder="粘贴平台 API Key"
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
              <div className="model-input-row">
                {modelOptions.length ? (
                  <select
                    className="model-select"
                    value={
                      modelOptions.includes(modelConfig.modelId)
                        ? modelConfig.modelId
                        : ""
                    }
                    onChange={(event) => {
                      if (!event.target.value) return
                      setModelConfig((current) => ({
                        ...current,
                        modelId: event.target.value
                      }))
                    }}
                  >
                    <option value="">选择模型</option>
                    {modelOptions.map((modelId) => (
                      <option key={modelId} value={modelId}>
                        {modelId}
                      </option>
                    ))}
                  </select>
                ) : (
                  <input
                    type="text"
                    value={modelConfig.modelId}
                    placeholder="手动填写模型名称"
                    onChange={(event) =>
                      setModelConfig((current) => ({
                        ...current,
                        modelId: event.target.value
                      }))
                    }
                  />
                )}
                <button
                  type="button"
                  className="inline-action"
                  onClick={fetchModelOptions}
                  disabled={
                    modelListBusy ||
                    !modelConfig.apiKey.trim() ||
                    !modelConfig.baseUrl.trim()
                  }
                >
                  {modelListBusy ? "获取中..." : "获取模型"}
                </button>
              </div>
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
