import path from "node:path"
import { defineConfig } from "vitest/config"

export default defineConfig({
  test: {
    environment: "node",
    setupFiles: ["./vitest.setup.ts"],
    include: [
      "src/**/*.test.ts",
      "cloudflare-worker/src/**/*.test.ts"
    ],
    coverage: {
      provider: "v8",
      reporter: ["text", "lcov"],
      include: [
        "src/utils/domainMatcher.ts",
        "src/utils/cache.ts",
        "src/services/securityEngine.ts",
        "src/services/brandMatcher.ts",
        "src/services/reporting.ts",
        "cloudflare-worker/src/fallbackAnalyze.ts"
      ]
    }
  },
  resolve: {
    alias: {
      "~": path.resolve(__dirname, "src")
    }
  }
})
