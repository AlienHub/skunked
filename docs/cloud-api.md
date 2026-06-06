# SKUNKED 云端 API 说明（MVP）

Base URL 示例：`https://skunked-api.example.workers.dev`

本 API 面向企业激活、策略、云语义研判与事件审计。公开应用目录与确认钓鱼域名
由独立的 SKUNKED Open Data API 提供，见
[`docs/open-data-api.md`](./open-data-api.md)。主云服务可以消费 open-data，但不
作为 open-data 的事实源。

## 1. `POST /v1/activate`

用于激活码绑定企业。

请求：

```json
{
  "activationCode": "ORG-XXXX-XXXX",
  "installationId": "uuid"
}
```

响应：

```json
{
  "activation": {
    "activated": true,
    "orgId": "org_demo",
    "token": "jwt-or-random-token",
    "endpoint": "https://skunked-api.example.workers.dev",
    "activatedAt": 1700000000000,
    "tokenExpiresAt": 1700600000000
  },
  "policy": {
    "warningThreshold": 60,
    "blockThreshold": 90,
    "mode": "balanced",
    "policyVersion": "cloud-default-v1",
    "updatedAt": 1700000000000
  }
}
```

## 健康检查

`GET /v1/health`：

```json
{
  "ok": true,
  "service": "skunked-cloud-api",
  "now": 1700000000000
}
```

## 2. `GET /v1/policy`

获取组织策略。

请求头：

```txt
Authorization: Bearer <token>
```

策略字段（`policy` 对象）：

| 字段 | 类型 | 默认 | 说明 |
| --- | --- | --- | --- |
| `warningThreshold` | number | `60` | 告警阈值（0–100） |
| `blockThreshold` | number | `90` | 阻断阈值（0–100） |
| `mode` | string | `balanced` | `balanced \| strict \| relaxed` |
| `brandSignalMode` | string | `url_only` | `url_only`：仅 URL 判断是否在防护范围；`page_signals`：企业可选，URL+页面标题等文案 |
| `policyVersion` | string | — | 策略版本号 |
| `updatedAt` | number | — | 更新时间戳 |

云语义研判（`POST /v1/analyze`）仅在企业激活后由扩展端调用；未激活终端不会请求该接口。

## 3. `POST /v1/analyze`

提交最小风险特征并获得统一判定。

请求：

```json
{
  "url": "https://example.com/download",
  "host": "example.com",
  "path": "/download",
  "title": "某某软件官方下载",
  "h1Text": "立即下载",
  "buttonTexts": ["免费下载", "高速下载"],
  "downloadKeywords": ["下载", "install"],
  "brandHint": "飞书",
  "layerHint": "keyword"
}
```

响应：

```json
{
  "verdict": "warn",
  "confidence": 72,
  "reason": "页面存在可疑下载诱导词",
  "matchedBrand": "飞书",
  "modelTraceId": "trace_xxx"
}
```

## 4. `POST /v1/events/batch`

批量上报风险事件。

请求：

```json
{
  "events": [
    {
      "id": "uuid",
      "ts": 1700000000000,
      "eventType": "blocked",
      "orgId": "org_demo",
      "installationId": "client-uuid",
      "urlHost": "abc.example",
      "riskVerdict": "block",
      "confidence": 95,
      "layer": "cloud",
        "actionTaken": "auto_blocked",
        "datasetVersion": "20260308.d3904f3d",
        "reason": "域名与官方高度相似"
      }
    ]
}
```

响应：

```json
{
  "accepted": 1
}
```

## 5. `GET /v1/events/export`

导出企业事件数据。

请求头：

```txt
x-admin-key: <internal-export-key>
```

查询参数：

- `orgId`：可选；
- `from` / `to`：时间戳范围；
- `format`：`json` 或 `csv`。

## 6. Open Data 兼容说明

历史版本的企业云 Worker 可能仍暴露 `/v1/open/*` 兼容端点，但新客户端应使用
独立 `PLASMO_PUBLIC_OPEN_DATA_API_BASE_URL` 指向 Open Data API。公开数据接口
的完整契约见 [`docs/open-data-api.md`](./open-data-api.md)。
