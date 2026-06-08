/**
 * Returns true when mock data should be used.
 * In dev mode (import.meta.dev), mocks are always active.
 * In production, mocks are disabled. Composables should read from chain.
 */
export function useMockData(): boolean {
  try {
    return !!(import.meta as any).dev
  } catch {
    return false
  }
}
