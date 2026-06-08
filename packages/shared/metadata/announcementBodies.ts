import type { AnnouncementBody } from './schemas'
import { useBulletinStorage } from './bulletin'
import { fetchInChunks } from '../utils/chunked'

/**
 * Fetch announcement bodies for the given CIDs and write each result via
 * `write(cid, body | null)`. `null` signals a failed fetch. Callers keep
 * the entry so the UI can render a "couldn't load" fallback instead of an
 * infinite skeleton.
 *
 * Callers filter to truly-missing CIDs before calling; this helper does no
 * de-duplication of its own.
 */
export async function fetchAnnouncementBodies(
  cids: readonly string[],
  write: (cid: string, body: AnnouncementBody | null) => void,
): Promise<void> {
  if (!cids.length) return
  const { retrievePlaintext } = useBulletinStorage()
  await fetchInChunks(cids, async (cid) => {
    try {
      const body = await retrievePlaintext<AnnouncementBody>(cid)
      write(cid, body)
    } catch (e) {
      console.warn('[announcementBodies] fetch failed:', cid, e)
      write(cid, null)
    }
  })
}
