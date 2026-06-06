import eslint from "@eslint/js"
import prettier from "eslint-config-prettier"
import simpleImportSort from "eslint-plugin-simple-import-sort"
import tseslint from "typescript-eslint"

export default tseslint.config(
  {
    ignores: [
      "build/**",
      ".plasmo/**",
      "dist/**",
      "node_modules/**",
      "cloudflare-worker/.wrangler/**",
      "**/*.mjs"
    ]
  },
  eslint.configs.recommended,
  ...tseslint.configs.recommended,
  prettier,
  {
    files: ["src/**/*.{ts,tsx}", "cloudflare-worker/src/**/*.ts"],
    plugins: {
      "simple-import-sort": simpleImportSort
    },
    rules: {
      "simple-import-sort/imports": "error",
      "simple-import-sort/exports": "error",
      "@typescript-eslint/no-unused-vars": [
        "error",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_" }
      ],
      "@typescript-eslint/no-explicit-any": "off",
      "no-control-regex": "off"
    }
  },
  {
    files: ["**/*.test.ts"],
    rules: {
      "simple-import-sort/imports": "off"
    }
  }
)
