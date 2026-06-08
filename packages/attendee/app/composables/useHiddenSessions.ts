import { ref } from 'vue'

const STORAGE_KEY = 'festival-hidden-sessions'

function loadHidden(): string[] {
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    return stored ? JSON.parse(stored) : []
  } catch {
    return []
  }
}

function persistHidden(addresses: string[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(addresses))
}

const hiddenAddresses = ref<string[]>(typeof window !== 'undefined' ? loadHidden() : [])

export function useHiddenSessions() {
  function hide(address: string) {
    const lower = address.toLowerCase()
    if (!hiddenAddresses.value.includes(lower)) {
      hiddenAddresses.value.push(lower)
      persistHidden(hiddenAddresses.value)
    }
  }

  function isHidden(address: string): boolean {
    return hiddenAddresses.value.includes(address.toLowerCase())
  }

  return { hiddenAddresses, hide, isHidden }
}
