import { ref } from 'vue'
import { useScheduledAlerts, type ScheduleAlertOutcome } from './useScheduledAlerts'

const STORAGE_KEY = 'festival-bookmarks'

export interface BookmarkPayload {
  startMs: number
  title: string
  deeplink: string
  location?: string
}

export type BookmarkAlert =
  | { kind: 'limit-reached'; ts: number }
  | { kind: 'permission-denied'; ts: number }
  | null

function loadBookmarks(): string[] {
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    return stored ? JSON.parse(stored) : []
  } catch {
    return []
  }
}

function persistBookmarks(ids: string[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(ids))
}

// Shared state across components
const bookmarkedIds = ref<string[]>(typeof window !== 'undefined' ? loadBookmarks() : [])
// Set when a schedule attempt fails in a way the UI should surface. `ts`
// changes on every set so the layout-level toast re-fires even when the
// same `kind` is set twice in a row.
const bookmarkAlert = ref<BookmarkAlert>(null)

export function useBookmarks() {
  async function toggleBookmark(id: string, payload?: BookmarkPayload): Promise<void> {
    const idx = bookmarkedIds.value.indexOf(id)
    const adding = idx < 0
    if (adding) {
      bookmarkedIds.value.push(id)
    } else {
      bookmarkedIds.value.splice(idx, 1)
    }
    persistBookmarks(bookmarkedIds.value)

    const alerts = useScheduledAlerts()
    if (adding && payload) {
      const outcome: ScheduleAlertOutcome = await alerts.schedule({ id, ...payload })
      if (outcome === 'limit-reached') {
        bookmarkAlert.value = { kind: 'limit-reached', ts: Date.now() }
      } else if (outcome === 'permission-denied') {
        bookmarkAlert.value = { kind: 'permission-denied', ts: Date.now() }
      }
    } else if (!adding) {
      void alerts.cancel(id)
    }
  }

  function isBookmarked(id: string): boolean {
    return bookmarkedIds.value.includes(id)
  }

  function clearBookmarkAlert() {
    bookmarkAlert.value = null
  }

  return { bookmarkedIds, toggleBookmark, isBookmarked, bookmarkAlert, clearBookmarkAlert }
}
