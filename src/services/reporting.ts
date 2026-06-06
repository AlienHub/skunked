import { CONFIG } from "../constants/config"
import { ReportingEvent } from "../types"
import { uploadEvents } from "./cloudClient"

function randomId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID()
  }

  return `${Date.now()}-${Math.random().toString(16).slice(2)}`
}

function digestText(value?: string) {
  if (!value) return ""
  return value.trim().slice(0, 80)
}

export function createSecurityEvent(input: Omit<ReportingEvent, "id" | "attempts">): ReportingEvent {
  return {
    ...input,
    id: randomId(),
    attempts: 0,
    titleDigest: digestText(input.titleDigest),
    h1Digest: digestText(input.h1Digest)
  }
}

async function getQueue(): Promise<ReportingEvent[]> {
  const data = await chrome.storage.local.get("reporting")
  return (data.reporting?.queue || []) as ReportingEvent[]
}

async function setQueue(queue: ReportingEvent[]): Promise<void> {
  const data = await chrome.storage.local.get("reporting")
  await chrome.storage.local.set({
    reporting: {
      ...(data.reporting || {}),
      queue
    }
  })
}

export async function enqueueEvent(event: ReportingEvent): Promise<void> {
  const queue = await getQueue()
  queue.push(event)
  await setQueue(queue)
}

export async function getQueueSize(): Promise<number> {
  const queue = await getQueue()
  return queue.length
}

export async function flushReportingQueue(): Promise<{ uploaded: number; remaining: number }> {
  const queue = await getQueue()
  if (!queue.length) {
    return { uploaded: 0, remaining: 0 }
  }

  const batch = queue.slice(0, CONFIG.CLOUD_REPORT_BATCH_SIZE)

  try {
    await uploadEvents(batch)
    const remaining = queue.slice(batch.length)
    await chrome.storage.local.set({
      reporting: {
        queue: remaining,
        lastUploadAt: Date.now()
      }
    })
    return {
      uploaded: batch.length,
      remaining: remaining.length
    }
  } catch {
    const failed = queue.map((item, index) => {
      if (index >= batch.length) return item
      return {
        ...item,
        attempts: (item.attempts || 0) + 1
      }
    }).filter((item) => (item.attempts || 0) <= CONFIG.REPORT_MAX_RETRIES)

    await setQueue(failed)

    return {
      uploaded: 0,
      remaining: failed.length
    }
  }
}
