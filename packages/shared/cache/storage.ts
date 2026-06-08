import { isInHost } from '../host/detect'

export interface CacheStorage {
  readJSON<T>(key: string): Promise<T | null>
  writeJSON(key: string, value: unknown): Promise<void>
  clear(key: string): Promise<void>
}

function createHostStorage(): CacheStorage {
  // Lazy import to avoid loading the host SDK in standalone
  let storage: any = null
  async function getHostStorage() {
    if (!storage) {
      const { hostLocalStorage } = await import('@novasamatech/host-api-wrapper')
      storage = hostLocalStorage
    }
    return storage
  }

  return {
    async readJSON<T>(key: string): Promise<T | null> {
      try {
        const s = await getHostStorage()
        const result = await s.readJSON(key)
        return result ?? null
      } catch {
        return null
      }
    },
    async writeJSON(key: string, value: unknown): Promise<void> {
      try {
        const s = await getHostStorage()
        await s.writeJSON(key, value)
      } catch (e) {
        console.warn('[CacheStorage] Host write failed:', e)
      }
    },
    async clear(key: string): Promise<void> {
      try {
        const s = await getHostStorage()
        await s.clear(key)
      } catch (e) {
        console.warn('[CacheStorage] Host clear failed:', e)
      }
    },
  }
}

function createLocalStorage(): CacheStorage {
  return {
    async readJSON<T>(key: string): Promise<T | null> {
      try {
        const raw = localStorage.getItem(key)
        if (!raw) return null
        return JSON.parse(raw) as T
      } catch {
        return null
      }
    },
    async writeJSON(key: string, value: unknown): Promise<void> {
      try {
        localStorage.setItem(key, JSON.stringify(value))
      } catch (e) {
        console.warn('[CacheStorage] localStorage write failed:', e)
      }
    },
    async clear(key: string): Promise<void> {
      localStorage.removeItem(key)
    },
  }
}

let instance: CacheStorage | null = null

export function getStorage(): CacheStorage {
  if (!instance) {
    instance = isInHost() ? createHostStorage() : createLocalStorage()
  }
  return instance
}
