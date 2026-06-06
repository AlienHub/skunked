import { beforeEach, describe, expect, it, vi } from "vitest"

import { CONFIG } from "../constants/config"
import type { ReportingEvent } from "../types"
import {
  createSecurityEvent,
  flushReportingQueue,
  getQueueSize
} from "./reporting"

vi.mock("./cloudClient", () => ({
  uploadEvents: vi.fn()
}))

import { uploadEvents } from "./cloudClient"

function baseEvent(
  overrides: Partial<ReportingEvent> = {}
): ReportingEvent {
  return {
    id: "event-1",
    ts: Date.now(),
    eventType: "warned",
    installationId: "install-1",
    urlHost: "fake.example",
    riskVerdict: "warn",
    confidence: 72,
    layer: "heuristics",
    actionTaken: "shown_warning",
    reason: "test",
    attempts: 0,
    ...overrides
  }
}

describe("reporting", () => {
  beforeEach(() => {
    vi.mocked(uploadEvents).mockReset()
  })

  it("creates events with digests and generated ids", () => {
    const event = createSecurityEvent({
      ts: Date.now(),
      eventType: "blocked",
      installationId: "install-1",
      urlHost: "evil.example",
      riskVerdict: "block",
      confidence: 95,
      layer: "blacklist",
      actionTaken: "auto_blocked",
      reason: "命中黑名单",
      titleDigest: `  ${"标题".repeat(40)}  `,
      h1Digest: "  "
    })

    expect(event.id).toBeTruthy()
    expect(event.attempts).toBe(0)
    expect(event.titleDigest?.length).toBeLessThanOrEqual(80)
    expect(event.h1Digest).toBe("")
  })

  it("uploads a batch and trims the queue on success", async () => {
    vi.mocked(uploadEvents).mockResolvedValueOnce({ accepted: 3 })

    const queue = Array.from({ length: 3 }, (_, index) =>
      baseEvent({ id: `event-${index}` })
    )
    await chrome.storage.local.set({ reporting: { queue } })

    const result = await flushReportingQueue()

    expect(uploadEvents).toHaveBeenCalledWith(queue)
    expect(result.uploaded).toBe(3)
    expect(result.remaining).toBe(0)
    expect(await getQueueSize()).toBe(0)
  })

  it("increments attempts for failed batch items and drops over max retries", async () => {
    vi.mocked(uploadEvents).mockRejectedValueOnce(new Error("network"))

    const queue = [
      baseEvent({ id: "retry-me", attempts: CONFIG.REPORT_MAX_RETRIES }),
      baseEvent({ id: "will-retry", attempts: 0 })
    ]

    await chrome.storage.local.set({ reporting: { queue } })

    const result = await flushReportingQueue()

    expect(result.uploaded).toBe(0)
    expect(uploadEvents).toHaveBeenCalledWith(queue)

    const storage = await chrome.storage.local.get("reporting")
    const remaining = (storage.reporting as { queue: ReportingEvent[] }).queue

    expect(remaining.find((item) => item.id === "retry-me")).toBeUndefined()
    expect(remaining.find((item) => item.id === "will-retry")?.attempts).toBe(1)
    expect(result.remaining).toBe(1)
  })
})
