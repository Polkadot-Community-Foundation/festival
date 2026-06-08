export default defineNuxtRouteMiddleware((_to) => {
  // Auth guard disabled in dev mode (no host available).
  // In production, the host gate in app.vue handles access control.
  if (import.meta.server || import.meta.dev) return
})
