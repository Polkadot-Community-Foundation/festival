/**
 * Pure helpers for unread-announcement + highlight math.
 */

/**
 * Count announcements unread relative to `lastReadCid`:
 * no lastRead → all unread; CID present → only those after it; CID absent
 * (dropped past the soft cap, or never seen) → all unread, so the user still
 * notices something arrived.
 */
export function computeUnreadCount(
  announcements: readonly string[],
  lastReadCid: string | null,
): number {
  if (announcements.length === 0) return 0
  if (!lastReadCid) return announcements.length
  const idx = announcements.indexOf(lastReadCid)
  if (idx === -1) return announcements.length
  return announcements.length - (idx + 1)
}

/**
 * CIDs to highlight when the inbox first opens — same semantics as
 * computeUnreadCount: everything after lastReadCid, or all if it's missing.
 */
export function snapshotUnreadCids(
  announcements: readonly string[],
  lastReadCid: string | null,
): string[] {
  if (announcements.length === 0) return []
  if (!lastReadCid) return [...announcements]
  const idx = announcements.indexOf(lastReadCid)
  if (idx === -1) return [...announcements]
  return announcements.slice(idx + 1)
}

/**
 * CIDs in `nextAnnouncements` not already in `seen`, in arrival order. Used to
 * highlight live arrivals while the notifications tab is open.
 */
export function newCidsSince(
  nextAnnouncements: readonly string[],
  seen: ReadonlySet<string>,
): string[] {
  const fresh: string[] = []
  for (const cid of nextAnnouncements) {
    if (!seen.has(cid)) fresh.push(cid)
  }
  return fresh
}
