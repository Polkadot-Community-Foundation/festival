import { ref } from 'vue'

const STORAGE_KEY = 'festival-onboarding-seen'

function load(): Set<string> {
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    return new Set(stored ? JSON.parse(stored) : [])
  } catch {
    return new Set()
  }
}

function persist(s: Set<string>) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify([...s]))
}

const seen = ref<Set<string>>(
  typeof window !== 'undefined' ? load() : new Set(),
)

export function useOnboardingSeen() {
  function has(key: string): boolean {
    return seen.value.has(key)
  }

  function markSeen(key: string) {
    if (seen.value.has(key)) return
    seen.value = new Set([...seen.value, key])
    persist(seen.value)
  }

  return { has, markSeen }
}
