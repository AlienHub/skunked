export const CONFIG = {
  // AI Provider: "openai" | "anthropic"
  AI_PROVIDER: "openai",

  // API Keys (should be loaded from environment or secure storage)
  // Users need to set these via extension options
  OPENAI_API_KEY: "",
  ANTHROPIC_API_KEY: "",

  // AI Model Selection
  OPENAI_MODEL: "gpt-4o-mini",
  ANTHROPIC_MODEL: "claude-3-haiku-20240307",

  // Thresholds
  WARNING_THRESHOLD: 60, // Show yellow warning bar
  BLOCK_THRESHOLD: 90, // Show red overlay

  // Cache
  CACHE_EXPIRY_MS: 86400000, // 24 hours

  // Performance
  MAX_DOM_EXTRACTION_TIME: 5000, // 5 seconds
  MAX_AI_REQUEST_TIME: 10000, // 10 seconds

  // Privacy
  ENABLE_ANALYTICS: false,
  LOG_LEVEL: "error" // "debug" | "info" | "warn" | "error"
}
