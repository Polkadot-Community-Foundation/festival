export type HostEnvironment = 'desktop-webview' | 'web-iframe' | 'standalone'

/**
 * Detect which host environment the product runs in.
 *
 * - `desktop-webview`: the desktop host sets `window.__HOST_WEBVIEW_MARK__`
 * - `web-iframe`: Web host loads the product in an iframe (`window !== window.top`)
 * - `standalone`: No host detected. Regular browser tab
 */
export function detectHostEnvironment(): HostEnvironment {
  if (typeof window === 'undefined') return 'standalone'

  // Desktop host sets this flag on the window object
  if ((window as any).__HOST_WEBVIEW_MARK__) return 'desktop-webview'

  // Web host loads the product inside an iframe.
  // Cross-origin access to `window.top` can throw. Catch and treat as iframe.
  try {
    if (window !== window.top) return 'web-iframe'
  } catch {
    // SecurityError means we're in a cross-origin iframe → host environment
    return 'web-iframe'
  }

  return 'standalone'
}

/** Returns true when the product is running inside any host. */
export function isInHost(): boolean {
  return detectHostEnvironment() !== 'standalone'
}

/**
 * iOS platform detection. Covers iPhone / iPod / classic iPad UAs and iPadOS
 * 13+ which sends a Mac UA but is distinguishable via touch points.
 */
export function isIOS(): boolean {
  if (typeof navigator === 'undefined') return false
  const ua = navigator.userAgent
  if (/iPhone|iPod|iPad/.test(ua)) return true
  if (/Mac/.test(ua) && navigator.maxTouchPoints > 1) return true
  return false
}

/**
 * True when running inside the iOS host. Used to apply iOS-host-only
 * workarounds (e.g. the host injects a viewport meta without `viewport-fit=cover`,
 * which collapses `env(safe-area-inset-*)` to 0).
 */
export function isHostIOS(): boolean {
  return isInHost() && isIOS()
}
