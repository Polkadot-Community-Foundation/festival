import type { InjectionKey, Ref } from 'vue'
import { inject } from 'vue'

export const APP_SCROLLER_KEY: InjectionKey<Ref<HTMLElement | null>> = Symbol('appScroller')

/**
 * The single scrolling element in the app. The `<main>` inside `app.vue`.
 * The document itself never scrolls under the new shell, so pages must use
 * this instead of `window` for scroll position, listeners, and programmatic
 * scrolling.
 */
export function useAppScroller(): Ref<HTMLElement | null> {
  const ref = inject(APP_SCROLLER_KEY, null)
  if (!ref) throw new Error('useAppScroller() called outside the app shell')
  return ref
}
