import { getStorage } from './storage'
import { bytes32ToCid } from '../metadata/cid'

function normalizeToCidString(cidOrBytes32: string): string {
  if (cidOrBytes32.startsWith('0x')) {
    return bytes32ToCid(cidOrBytes32 as `0x${string}`).toString()
  }
  return cidOrBytes32
}

function cacheKey(cidOrBytes32: string): string {
  return `cid:${normalizeToCidString(cidOrBytes32)}`
}

/** Read cached metadata for a CID. Returns null on cache miss. */
export async function getCachedMetadata<T>(cidOrBytes32: string): Promise<T | null> {
  return getStorage().readJSON<T>(cacheKey(cidOrBytes32))
}

/** Cache metadata under its CID. Content-addressed data is immutable. Never needs invalidation. */
export async function setCachedMetadata(cidOrBytes32: string, data: unknown): Promise<void> {
  return getStorage().writeJSON(cacheKey(cidOrBytes32), data)
}
