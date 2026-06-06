import fs from "node:fs/promises"
import os from "node:os"
import path from "node:path"
import { spawnSync } from "node:child_process"
import { fileURLToPath } from "node:url"
import { loadAndValidateDataset } from "../../scripts/open-data-lib.mjs"

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

function sqlValue(value) {
  if (value === null || value === undefined) return "NULL"
  if (typeof value === "number") return Number.isFinite(value) ? String(value) : "NULL"
  return `'${String(value).replace(/'/g, "''")}'`
}

function createSql(dataset) {
  const now = Date.now()
  const lines = [
    "BEGIN TRANSACTION;",
    "DELETE FROM dataset_official_domains;",
    "DELETE FROM dataset_phishing_domains;",
    "DELETE FROM dataset_apps;"
  ]

  for (const app of dataset.apps) {
    lines.push(
      `INSERT INTO dataset_apps (id, slug, name, name_en, category, official_urls_json, keywords_json, updated_at) VALUES (${sqlValue(app.id)}, ${sqlValue(app.slug)}, ${sqlValue(app.name)}, ${sqlValue(app.nameEn)}, ${sqlValue(app.category)}, ${sqlValue(JSON.stringify(app.officialUrls))}, ${sqlValue(JSON.stringify(app.keywords))}, ${sqlValue(now)});`
    )

    for (const domain of app.officialDomains) {
      lines.push(
        `INSERT INTO dataset_official_domains (domain, app_id, updated_at) VALUES (${sqlValue(domain)}, ${sqlValue(app.id)}, ${sqlValue(now)});`
      )
    }
  }

  for (const item of dataset.phishingConfirmed) {
    lines.push(
      `INSERT INTO dataset_phishing_domains (domain, target_app_id, status, source, first_seen_at, last_seen_at, reviewed_at, reviewer, updated_at) VALUES (${sqlValue(item.domain)}, ${sqlValue(item.targetAppId || null)}, ${sqlValue(item.status)}, ${sqlValue(item.source)}, ${sqlValue(item.firstSeenAt)}, ${sqlValue(item.lastSeenAt)}, ${sqlValue(item.reviewedAt)}, ${sqlValue(item.reviewer)}, ${sqlValue(now)});`
    )
  }

  lines.push("UPDATE dataset_versions SET is_active = 0 WHERE is_active = 1;")
  lines.push(
    `INSERT INTO dataset_versions (version, generated_at, sha256, apps_count, official_domains_count, phishing_confirmed_count, is_active, created_at) VALUES (${sqlValue(dataset.manifest.version)}, ${sqlValue(dataset.manifest.generatedAt)}, ${sqlValue(dataset.manifest.sha256)}, ${sqlValue(dataset.manifest.recordCounts.apps)}, ${sqlValue(dataset.manifest.recordCounts.officialDomains)}, ${sqlValue(dataset.manifest.recordCounts.phishingConfirmed)}, 1, ${sqlValue(now)});`
  )

  lines.push("COMMIT;")
  return lines.join("\n")
}

async function main() {
  const [, , databaseName, ...restArgs] = process.argv
  const remote = restArgs.includes("--remote")

  if (!databaseName) {
    throw new Error("Usage: node ./scripts/import-open-data.mjs <d1_database_name> [--remote]")
  }

  const dataset = await loadAndValidateDataset()
  const sql = createSql(dataset)
  const tmpFile = path.join(os.tmpdir(), `skunked-dataset-${Date.now()}.sql`)

  await fs.writeFile(tmpFile, sql, "utf8")

  const args = ["exec", "wrangler", "d1", "execute", databaseName, "--file", tmpFile]
  if (remote) args.push("--remote")

  const result = spawnSync("pnpm", args, {
    cwd: path.resolve(__dirname, ".."),
    stdio: "inherit"
  })

  await fs.rm(tmpFile, { force: true })

  if (result.status !== 0) {
    throw new Error(`wrangler d1 execute failed with status ${result.status}`)
  }

  console.log("Open dataset imported to D1")
  console.log(`- version: ${dataset.manifest.version}`)
  console.log(`- apps: ${dataset.apps.length}`)
  console.log(`- confirmed phishing: ${dataset.phishingConfirmed.length}`)
}

main().catch((error) => {
  console.error(`Failed to import open dataset: ${error.message}`)
  process.exitCode = 1
})
