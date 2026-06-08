export default defineNuxtRouteMiddleware((_to) => {
  if (import.meta.server || import.meta.dev) return
})
