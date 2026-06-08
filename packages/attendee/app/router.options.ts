import type { RouterConfig } from '@nuxt/schema'

/**
 * The app uses an internal scroll container (see app.vue). The document
 * itself never scrolls. Vue Router's default scrollBehavior calls
 * `window.scrollTo`, which does nothing here, so route changes would leave
 * the new page at whatever scrollTop the previous page had.
 *
 * Override to scroll our `<main data-app-scroller>` element instead, on the
 * next frame so it runs after the new page mounts.
 */
export default <RouterConfig>{
  scrollBehavior(_to, _from, savedPosition) {
    if (typeof document === 'undefined') return
    const top = savedPosition && 'top' in savedPosition ? Number(savedPosition.top) || 0 : 0
    requestAnimationFrame(() => {
      const scroller = document.querySelector<HTMLElement>('[data-app-scroller]')
      scroller?.scrollTo({ top, behavior: 'auto' })
    })
  },
}
