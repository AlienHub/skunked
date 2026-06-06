import "./options.css"

import { useEffect, useState } from "react"

interface RuntimeInfo {
  activated: boolean
  orgId?: string
  policyVersion?: string
  queueSize?: number
  datasetVersion?: string
}

interface Policy {
  warningThreshold: number
  blockThreshold: number
  mode: string
  brandSignalMode?: string
}

function IndexOptions() {
  const [activationCode, setActivationCode] = useState("")
  const [runtimeInfo, setRuntimeInfo] = useState<RuntimeInfo>({
    activated: false
  })
  const [policy, setPolicy] = useState<Policy>({
    warningThreshold: 60,
    blockThreshold: 90,
    mode: "balanced"
  })
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState("")

  const load = () => {
    chrome.runtime.sendMessage({ action: "get_runtime_info" }, (response) => {
      if (response?.success) {
        setRuntimeInfo(response.data)
      }
    })
    chrome.storage.local.get("policy", (data) => {
      if (data.policy?.effective) {
        setPolicy(data.policy.effective)
      }
    })
  }

  useEffect(() => {
    load()
  }, [])

  const activate = () => {
    if (!activationCode.trim()) {
      setMessage("请输入激活码")
      return
    }

    setBusy(true)
    setMessage("")
    chrome.runtime.sendMessage(
      {
        action: "activate_tenant",
        data: {
          activationCode: activationCode.trim()
        }
      },
      (response) => {
        setBusy(false)
        if (response?.success) {
          setMessage("激活成功，企业策略已生效")
          setActivationCode("")
          load()
        } else {
          setMessage(response?.error || "激活失败，请检查激活码")
        }
      }
    )
  }

  const syncPolicy = () => {
    setBusy(true)
    setMessage("")
    chrome.runtime.sendMessage({ action: "sync_policy" }, (response) => {
      setBusy(false)
      if (response?.success) {
        setMessage("策略同步成功")
        load()
      } else {
        setMessage(response?.error || "策略同步失败")
      }
    })
  }

  const flushReporting = () => {
    setBusy(true)
    setMessage("")
    chrome.runtime.sendMessage({ action: "flush_reporting" }, (response) => {
      setBusy(false)
      if (response?.success) {
        setMessage("上报队列已触发同步")
        load()
      } else {
        setMessage(response?.error || "上报失败")
      }
    })
  }

  const syncOpenDataset = () => {
    setBusy(true)
    setMessage("")
    chrome.runtime.sendMessage({ action: "sync_open_dataset" }, (response) => {
      setBusy(false)
      if (response?.success) {
        setMessage("公开数据集同步成功")
        load()
      } else {
        setMessage(response?.error || "公开数据集同步失败")
      }
    })
  }

  const protectionMode = runtimeInfo.activated ? "企业增强防护" : "免费基础防护"
  const brandSignalLabel =
    policy.brandSignalMode === "page_signals"
      ? "URL + 页面文案（企业增强）"
      : "仅 URL（免费默认）"

  return (
    <main className="options-root">
      <div className="hero">
        <span className="eyebrow">{protectionMode}</span>
        <h1>SKUNKED 防护设置</h1>
        <p>
          插件安装后即可使用本地规则、公开数据集和相似域名检测。企业激活只用于开启云语义研判、组织策略和事件审计。
        </p>
      </div>

      <section className="panel protection-summary">
        <div>
          <h2>基础防护已开启</h2>
          <p className="caption">
            无需登录或激活码，也会阻断确认钓鱼域名、识别高仿域名，并引导用户前往官方站点。
          </p>
        </div>
        <div className="summary-grid">
          <div>
            <strong>本地规则</strong>
            <span>官方域 / 黑名单 / 相似域名</span>
          </div>
          <div>
            <strong>公开数据集</strong>
            <span>{runtimeInfo.datasetVersion || "fallback-local-v1"}</span>
          </div>
          <div>
            <strong>品牌识别</strong>
            <span>{brandSignalLabel}</span>
          </div>
        </div>
      </section>

      <section className="panel">
        <h2>企业增强</h2>
        <p className="caption">
          可选能力：接入企业策略、云端语义研判和事件审计；未激活不影响免费基础防护。
        </p>
        <div className="row">
          <input
            type="text"
            value={activationCode}
            placeholder="输入企业激活码"
            onChange={(event) => setActivationCode(event.target.value)}
          />
          <button disabled={busy} onClick={activate}>
            {busy
              ? "处理中..."
              : runtimeInfo.activated
                ? "更新绑定"
                : "开启增强"}
          </button>
        </div>
      </section>

      <section className="panel">
        <h2>当前状态</h2>
        <ul className="status-list">
          <li>
            <strong>防护模式：</strong>
            {protectionMode}
          </li>
          <li>
            <strong>企业绑定：</strong>
            {runtimeInfo.activated
              ? `已绑定 (${runtimeInfo.orgId || "未知组织"})`
              : "未绑定（不影响免费防护）"}
          </li>
          <li>
            <strong>策略版本：</strong>
            {runtimeInfo.policyVersion || "local-default"}
          </li>
          <li>
            <strong>待上报事件：</strong>
            {runtimeInfo.queueSize ?? 0}
          </li>
          <li>
            <strong>数据集版本：</strong>
            {runtimeInfo.datasetVersion || "fallback-local-v1"}
          </li>
          <li>
            <strong>策略模式：</strong>
            {policy.mode}
          </li>
          <li>
            <strong>品牌识别：</strong>
            {brandSignalLabel}
          </li>
          <li>
            <strong>阈值：</strong>
            警告 {policy.warningThreshold}% / 阻断 {policy.blockThreshold}%
          </li>
        </ul>
      </section>

      <section className="panel panel-actions">
        <button className="secondary" onClick={syncPolicy} disabled={busy}>
          同步策略
        </button>
        <button className="secondary" onClick={flushReporting} disabled={busy}>
          立即上报事件
        </button>
        <button className="secondary" onClick={syncOpenDataset} disabled={busy}>
          同步公开数据集
        </button>
      </section>

      <section className="panel policy-note">
        <h2>防护说明</h2>
        <ol>
          <li>免费版默认启用本地检测，不需要企业账号或 API Key。</li>
          <li>高风险页面会被阻断，并提供官方站点入口。</li>
          <li>中等风险仅展示告警，用户可以自行关闭提示。</li>
          <li>
            未激活企业时不调用云语义研判；需要云复核的场景会用本地规则降级提醒。
          </li>
          <li>企业增强开启后，才会使用组织策略、页面文案识别和事件审计。</li>
        </ol>
      </section>

      {message ? <p className="feedback">{message}</p> : null}
    </main>
  )
}

export default IndexOptions
