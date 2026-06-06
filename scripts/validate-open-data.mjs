import { loadAndValidateDataset } from "./open-data-lib.mjs"

async function main() {
  const result = await loadAndValidateDataset()

  console.log("Open dataset validation passed")
  console.log(`- apps: ${result.apps.length}`)
  console.log(`- official domains: ${result.manifest.recordCounts.officialDomains}`)
  console.log(`- confirmed phishing domains: ${result.phishingConfirmed.length}`)
  console.log(`- next version: ${result.manifest.version}`)
}

main().catch((error) => {
  console.error(`Open dataset validation failed: ${error.message}`)
  process.exitCode = 1
})
