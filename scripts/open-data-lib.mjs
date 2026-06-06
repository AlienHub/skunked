import crypto from "node:crypto"
import fs from "node:fs/promises"
import path from "node:path"
import { fileURLToPath } from "node:url"

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const DATASET_ROOT = path.resolve(__dirname, "..", "open-data")
const CATEGORY_SET = new Set(["office", "communication", "remote_control", "security"])
const DOMAIN_RE = /^(?!www\.)[a-z0-9-]+(\.[a-z0-9-]+)+$/

function assert(condition, message) {
  if (!condition) {
    throw new Error(message)
  }
}

export async function readJsonFile(filePath) {
  const raw = await fs.readFile(filePath, "utf8")
  return JSON.parse(raw)
}

function asNonEmptyString(value, fieldName) {
  assert(typeof value === "string", `${fieldName} must be a string`)
  const trimmed = value.trim()
  assert(trimmed.length > 0, `${fieldName} must not be empty`)
  return trimmed
}

export function normalizeDomain(input, fieldName = "domain") {
  const value = asNonEmptyString(input, fieldName).toLowerCase()
  const withoutProtocol = value.replace(/^https?:\/\//, "")
  const withoutWww = withoutProtocol.replace(/^www\./, "")
  const withoutPath = withoutWww.split("/")[0].split("?")[0].split("#")[0]
  const withoutPort = withoutPath.split(":")[0]

  assert(DOMAIN_RE.test(withoutPort), `${fieldName} must be a valid host domain`)
  return withoutPort
}

function normalizeHttpsUrl(input, fieldName) {
  const value = asNonEmptyString(input, fieldName)
  let parsed
  try {
    parsed = new URL(value)
  } catch {
    throw new Error(`${fieldName} must be a valid URL`)
  }

  assert(parsed.protocol === "https:", `${fieldName} must use https`) 
  return parsed.toString().replace(/\/$/, "")
}

function normalizeKeywords(keywords, fieldName) {
  assert(Array.isArray(keywords), `${fieldName} must be an array`)
  assert(keywords.length > 0, `${fieldName} must not be empty`)

  const seen = new Set()
  const normalized = []

  for (const keyword of keywords) {
    const value = asNonEmptyString(keyword, fieldName)
    const dedupeKey = value.toLowerCase()
    if (seen.has(dedupeKey)) continue
    seen.add(dedupeKey)
    normalized.push(value)
  }

  assert(normalized.length > 0, `${fieldName} must contain at least one unique keyword`)
  return normalized
}

function parseIsoTimestamp(value, fieldName) {
  const normalized = asNonEmptyString(value, fieldName)
  const parsed = Date.parse(normalized)
  assert(!Number.isNaN(parsed), `${fieldName} must be an ISO date-time string`)
  return new Date(parsed).toISOString()
}

export function validateApps(input) {
  assert(Array.isArray(input), "apps.json must be an array")
  assert(input.length > 0, "apps.json must contain at least one app")

  const idSet = new Set()
  const slugSet = new Set()

  const normalizedApps = input.map((raw, index) => {
    assert(raw && typeof raw === "object" && !Array.isArray(raw), `apps[${index}] must be an object`)

    const id = asNonEmptyString(raw.id, `apps[${index}].id`).toLowerCase()
    const slug = asNonEmptyString(raw.slug, `apps[${index}].slug`).toLowerCase()
    const name = asNonEmptyString(raw.name, `apps[${index}].name`)
    const nameEn = asNonEmptyString(raw.nameEn, `apps[${index}].nameEn`)
    const category = asNonEmptyString(raw.category, `apps[${index}].category`)

    assert(/^[a-z0-9-]+$/.test(id), `apps[${index}].id must match ^[a-z0-9-]+$`)
    assert(/^[a-z0-9-]+$/.test(slug), `apps[${index}].slug must match ^[a-z0-9-]+$`)
    assert(CATEGORY_SET.has(category), `apps[${index}].category is invalid`)
    assert(!idSet.has(id), `duplicate app id: ${id}`)
    assert(!slugSet.has(slug), `duplicate app slug: ${slug}`)

    idSet.add(id)
    slugSet.add(slug)

    assert(Array.isArray(raw.officialDomains), `apps[${index}].officialDomains must be an array`)
    assert(raw.officialDomains.length > 0, `apps[${index}].officialDomains must not be empty`)

    const domainSet = new Set()
    const officialDomains = raw.officialDomains.map((domain, domainIndex) => {
      const normalized = normalizeDomain(domain, `apps[${index}].officialDomains[${domainIndex}]`)
      assert(!domainSet.has(normalized), `duplicate official domain in app ${id}: ${normalized}`)
      domainSet.add(normalized)
      return normalized
    })

    assert(Array.isArray(raw.officialUrls), `apps[${index}].officialUrls must be an array`)
    assert(raw.officialUrls.length > 0, `apps[${index}].officialUrls must not be empty`)

    const officialUrls = raw.officialUrls.map((url, urlIndex) =>
      normalizeHttpsUrl(url, `apps[${index}].officialUrls[${urlIndex}]`)
    )

    const keywords = normalizeKeywords(raw.keywords, `apps[${index}].keywords`)

    return {
      id,
      slug,
      name,
      nameEn,
      category,
      officialDomains,
      officialUrls,
      keywords
    }
  })

  return normalizedApps
}

export function validatePhishingConfirmed(input, appIdSet) {
  assert(Array.isArray(input), "phishing-confirmed.json must be an array")

  const domainSet = new Set()
  const normalizedEntries = input.map((raw, index) => {
    assert(raw && typeof raw === "object" && !Array.isArray(raw), `phishing[${index}] must be an object`)

    const domain = normalizeDomain(raw.domain, `phishing[${index}].domain`)
    const status = asNonEmptyString(raw.status, `phishing[${index}].status`).toLowerCase()
    const source = asNonEmptyString(raw.source, `phishing[${index}].source`)
    const firstSeenAt = parseIsoTimestamp(raw.firstSeenAt, `phishing[${index}].firstSeenAt`)
    const lastSeenAt = parseIsoTimestamp(raw.lastSeenAt, `phishing[${index}].lastSeenAt`)
    const reviewedAt = parseIsoTimestamp(raw.reviewedAt, `phishing[${index}].reviewedAt`)
    const reviewer = asNonEmptyString(raw.reviewer, `phishing[${index}].reviewer`)

    assert(status === "confirmed", `phishing[${index}].status must be confirmed`)
    assert(!domainSet.has(domain), `duplicate phishing domain: ${domain}`)
    domainSet.add(domain)

    if (raw.targetAppId !== undefined) {
      const targetAppId = asNonEmptyString(raw.targetAppId, `phishing[${index}].targetAppId`).toLowerCase()
      assert(appIdSet.has(targetAppId), `phishing[${index}].targetAppId references unknown app id: ${targetAppId}`)
      raw.targetAppId = targetAppId
    }

    assert(Date.parse(lastSeenAt) >= Date.parse(firstSeenAt), `phishing[${index}] lastSeenAt must be >= firstSeenAt`)
    assert(Date.parse(reviewedAt) >= Date.parse(firstSeenAt), `phishing[${index}] reviewedAt must be >= firstSeenAt`)

    return {
      domain,
      targetAppId: raw.targetAppId,
      status,
      source,
      firstSeenAt,
      lastSeenAt,
      reviewedAt,
      reviewer
    }
  })

  return normalizedEntries
}

export function createDatasetManifest(dataset) {
  const canonicalPayload = {
    apps: dataset.apps,
    phishingConfirmed: dataset.phishingConfirmed
  }

  const canonicalText = JSON.stringify(canonicalPayload)
  const sha256 = crypto.createHash("sha256").update(canonicalText).digest("hex")
  const generatedAt = new Date().toISOString()
  const versionPrefix = generatedAt.slice(0, 10).replace(/-/g, "")

  return {
    version: `${versionPrefix}.${sha256.slice(0, 8)}`,
    generatedAt,
    recordCounts: {
      apps: dataset.apps.length,
      officialDomains: dataset.apps.reduce((acc, app) => acc + app.officialDomains.length, 0),
      phishingConfirmed: dataset.phishingConfirmed.length
    },
    sha256
  }
}

export async function loadAndValidateDataset() {
  const appsPath = path.join(DATASET_ROOT, "apps.json")
  const phishingPath = path.join(DATASET_ROOT, "phishing-confirmed.json")
  const appsSchemaPath = path.join(DATASET_ROOT, "schema", "apps.schema.json")
  const phishingSchemaPath = path.join(DATASET_ROOT, "schema", "phishing-confirmed.schema.json")

  const [appsRaw, phishingRaw, appsSchema, phishingSchema] = await Promise.all([
    readJsonFile(appsPath),
    readJsonFile(phishingPath),
    readJsonFile(appsSchemaPath),
    readJsonFile(phishingSchemaPath)
  ])

  // We keep runtime validation in this script and use schema files as public contract docs.
  assert(appsSchema?.type === "array", "apps.schema.json must define an array schema")
  assert(phishingSchema?.type === "array", "phishing-confirmed.schema.json must define an array schema")

  const apps = validateApps(appsRaw)
  const phishingConfirmed = validatePhishingConfirmed(
    phishingRaw,
    new Set(apps.map((app) => app.id))
  )

  const manifest = createDatasetManifest({ apps, phishingConfirmed })

  return {
    apps,
    phishingConfirmed,
    manifest,
    paths: {
      root: DATASET_ROOT,
      appsPath,
      phishingPath,
      appsSchemaPath,
      phishingSchemaPath,
      manifestPath: path.join(DATASET_ROOT, "dataset-manifest.json")
    }
  }
}

export async function writeManifest(manifestPath, manifest) {
  await fs.writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, "utf8")
}

export function getDatasetRoot() {
  return DATASET_ROOT
}
