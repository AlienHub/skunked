import type { EffectivePolicy, OfficialSoftware, OpenDatasetState } from "../types"

export const TEST_POLICY: EffectivePolicy = {
  warningThreshold: 60,
  blockThreshold: 90,
  mode: "balanced",
  brandSignalMode: "url_only",
  policyVersion: "test-policy",
  updatedAt: Date.now()
}

export const TEST_POLICY_PAGE_SIGNALS: EffectivePolicy = {
  ...TEST_POLICY,
  brandSignalMode: "page_signals",
  policyVersion: "test-policy-page-signals"
}

export const TEST_FEISHU_APP: OfficialSoftware = {
  id: "feishu",
  slug: "feishu",
  name: "飞书",
  nameEn: "Feishu",
  category: "communication",
  officialDomains: ["feishu.cn"],
  officialUrls: ["https://www.feishu.cn"],
  keywords: ["飞书", "feishu", "lark", "下载", "install"]
}

export const TEST_DATASET: OpenDatasetState = {
  datasetVersion: "test-v1",
  updatedAt: Date.now(),
  lastSyncedAt: 0,
  apps: [TEST_FEISHU_APP],
  phishingConfirmed: [
    {
      domain: "evil-phish.example",
      targetAppId: "feishu",
      status: "confirmed",
      source: "test",
      firstSeenAt: "2026-01-01",
      lastSeenAt: "2026-01-01",
      reviewedAt: "2026-01-01",
      reviewer: "test"
    }
  ]
}
