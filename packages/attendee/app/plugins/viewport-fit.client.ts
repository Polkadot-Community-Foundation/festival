// Keep `viewport-fit=cover` on the viewport meta so env(safe-area-inset-*)
// reports real values.
//
// The Polkadot iOS host injects its OWN `<meta name="viewport">` at
// document-end (polkadot-app-ios-v2 SPAScriptsFactory.swift `disableZoomScript`)
// and it omits `viewport-fit=cover`. WebKit treats the last viewport meta as
// authoritative — unspecified keys revert to defaults — so that late injection
// clobbers the `viewport-fit=cover` we set in nuxt.config and resets it to
// `auto`. With `auto`, WebKit clamps the layout viewport to the safe area and
// env(safe-area-inset-bottom) resolves to 0, so the bottom nav's
// `pb-[var(--safe-bottom)]` adds nothing and the icons sit under the home
// indicator.
//
// We re-add `viewport-fit=cover` to every viewport meta after the host's
// injection and keep it that way via a MutationObserver. On web/desktop hosts
// there is no injected meta and env() is 0 regardless, so this is a no-op.
export default defineNuxtPlugin(() => {
  if (typeof document === 'undefined') return

  function ensureCover() {
    const metas = document.head.querySelectorAll<HTMLMetaElement>('meta[name="viewport"]')
    metas.forEach((meta) => {
      if (/viewport-fit\s*=\s*cover/i.test(meta.content)) return
      // Strip any non-cover viewport-fit value, then append cover. Editing the
      // content attribute re-triggers WebKit's viewport parse.
      const base = meta.content
        .replace(/\s*,?\s*viewport-fit\s*=\s*[^,]+/gi, '')
        .replace(/,\s*$/, '')
        .trim()
      meta.content = base ? `${base}, viewport-fit=cover` : 'viewport-fit=cover'
    })
  }

  // Run now (covers the case where the host meta already landed) and keep
  // watching <head> so a later host injection gets normalised too. Re-writing
  // content above fires another mutation, but the cover guard makes it a no-op.
  ensureCover()
  const observer = new MutationObserver(ensureCover)
  observer.observe(document.head, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: ['content', 'name'],
  })
})
