import { PREIMAGE_FETCH_CHUNK_SIZE } from '../host/constants'

/**
 * Run `fetchOne` over `items` in fixed-size waves with `Promise.all` per wave.
 * Default chunk size matches Bulletin Chain's preimage-fetch budget so one
 * page = one fetch burst.
 *
 * Contract: `fetchOne` must catch its own per-item errors. If it throws,
 * `Promise.all` rejects the wave and subsequent waves never run. Callers that
 * need partial success should wrap their per-item work in `.catch()`.
 */
export async function fetchInChunks<T>(
  items: readonly T[],
  fetchOne: (item: T) => Promise<void>,
  chunkSize: number = PREIMAGE_FETCH_CHUNK_SIZE,
): Promise<void> {
  for (let i = 0; i < items.length; i += chunkSize) {
    const chunk = items.slice(i, i + chunkSize)
    await Promise.all(chunk.map(fetchOne))
  }
}
