import { afterEach, vi } from "vitest"

type StorageMap = Record<string, unknown>

function createChromeStorageMock() {
  const data: StorageMap = {}

  return {
    get: vi.fn(async (keys?: string | string[] | null) => {
      if (keys == null) {
        return { ...data }
      }

      if (typeof keys === "string") {
        return keys in data ? { [keys]: data[keys] } : {}
      }

      const result: StorageMap = {}
      for (const key of keys) {
        if (key in data) {
          result[key] = data[key]
        }
      }
      return result
    }),
    set: vi.fn(async (items: StorageMap) => {
      Object.assign(data, items)
    }),
    remove: vi.fn(async (keys: string | string[]) => {
      const list = Array.isArray(keys) ? keys : [keys]
      for (const key of list) {
        delete data[key]
      }
    }),
    clear: vi.fn(async () => {
      for (const key of Object.keys(data)) {
        delete data[key]
      }
    }),
    _data: data,
    _reset() {
      for (const key of Object.keys(data)) {
        delete data[key]
      }
    }
  }
}

const local = createChromeStorageMock()

globalThis.chrome = {
  storage: {
    local
  },
  runtime: {
    getManifest: () => ({ version: "test" })
  }
} as typeof chrome

afterEach(() => {
  local._reset()
  vi.clearAllMocks()
  vi.unstubAllGlobals()
})
