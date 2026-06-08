import { useHostTheme } from '@festival/shared/host/theme'

// Apply the host's active theme to <html data-theme="..."> while the user is on
// the /onboarding route. Other routes get the attribute removed so the rest of
// the app continues to render with the legacy dark tokens.
export default defineNuxtPlugin((nuxtApp) => {
  const { themeSlug } = useHostTheme()
  const route = useRoute()

  const root = document.documentElement

  function apply() {
    const onOnboarding = route.path.startsWith('/onboarding')
    if (onOnboarding) {
      root.dataset.theme = themeSlug.value
    } else if (root.dataset.theme) {
      delete root.dataset.theme
    }
  }

  // React both to host theme changes and route changes.
  watch([themeSlug, () => route.path], apply, { immediate: true })
})
