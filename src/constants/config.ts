function readEnvString(key: string, fallback: string): string {
  const value = process.env[key]?.trim()
  return value || fallback
}

function readEnvNumber(key: string, fallback: number): number {
  const raw = process.env[key]?.trim()
  if (!raw) return fallback

  const parsed = Number(raw)
  return Number.isFinite(parsed) ? parsed : fallback
}

export const CONFIG = {
  CLOUD_API_BASE_URL: readEnvString(
    "PLASMO_PUBLIC_CLOUD_API_BASE_URL",
    "https://skunked-cloud-api.zhouxiansheng1958.workers.dev"
  ),
  OPEN_DATA_API_BASE_URL: readEnvString(
    "PLASMO_PUBLIC_OPEN_DATA_API_BASE_URL",
    "https://skunked-open-data.pindo.page"
  ),
  CLOUD_ANALYZE_TIMEOUT_MS: readEnvNumber(
    "PLASMO_PUBLIC_CLOUD_ANALYZE_TIMEOUT_MS",
    1800
  ),
  CLOUD_POLICY_SYNC_INTERVAL_MINUTES: readEnvNumber(
    "PLASMO_PUBLIC_CLOUD_POLICY_SYNC_INTERVAL_MINUTES",
    30
  ),
  OPEN_DATASET_SYNC_INTERVAL_MINUTES: readEnvNumber(
    "PLASMO_PUBLIC_OPEN_DATASET_SYNC_INTERVAL_MINUTES",
    360
  ),
  CLOUD_REPORT_UPLOAD_INTERVAL_MINUTES: readEnvNumber(
    "PLASMO_PUBLIC_CLOUD_REPORT_UPLOAD_INTERVAL_MINUTES",
    2
  ),
  CLOUD_REPORT_BATCH_SIZE: readEnvNumber(
    "PLASMO_PUBLIC_CLOUD_REPORT_BATCH_SIZE",
    20
  ),

  // Local fallback thresholds (used before policy sync or in offline mode)
  WARNING_THRESHOLD: readEnvNumber("PLASMO_PUBLIC_WARNING_THRESHOLD", 60),
  BLOCK_THRESHOLD: readEnvNumber("PLASMO_PUBLIC_BLOCK_THRESHOLD", 90),
  CACHE_EXPIRY_MS: readEnvNumber("PLASMO_PUBLIC_CACHE_EXPIRY_MS", 86400000),

  // Queue retries
  REPORT_MAX_RETRIES: readEnvNumber("PLASMO_PUBLIC_REPORT_MAX_RETRIES", 5),

  LOG_LEVEL: readEnvString("PLASMO_PUBLIC_LOG_LEVEL", "warn") as
    | "debug"
    | "info"
    | "warn"
    | "error"
}
