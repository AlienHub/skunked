import { loadAndValidateDataset, writeManifest } from "./open-data-lib.mjs"

async function main() {
  const result = await loadAndValidateDataset()
  await writeManifest(result.paths.manifestPath, result.manifest)

  console.log("Open dataset manifest updated")
  console.log(`- file: ${result.paths.manifestPath}`)
  console.log(`- version: ${result.manifest.version}`)
  console.log(`- sha256: ${result.manifest.sha256}`)
}

main().catch((error) => {
  console.error(`Failed to build manifest: ${error.message}`)
  process.exitCode = 1
})
