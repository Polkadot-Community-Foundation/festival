import { computed, type WritableComputedRef } from 'vue'
import type { FestivalMetadata } from '@festival/shared/metadata/schemas'
import type { FestivalDetails } from '@festival/shared/contracts/types'
import { useWalletStore } from '@festival/shared/host/wallet'
import { walletAddressToH160 } from '@festival/shared/utils/address'
import { festivalState } from '@festival/shared/cache/festival-state'
import { bootLoadAdmin } from './useBootLoad'

export interface FestivalState {
  address: string
  metadata: FestivalMetadata | null
  details: FestivalDetails | null
  isLoading: boolean
  error: string | null
}

/**
 * Festival composable for the admin SPA: thin selectors over `festivalState`.
 * Loading is owned by `bootLoadAdmin` (called once from layouts/festival.vue).
 * The `_address` arg is kept for API compatibility; admin shows one festival at
 * a time (driven by the route `:address`), so the singleton's current festival
 * is always the one being viewed.
 */
export function useFestival(_address: string) {
  const metadata: WritableComputedRef<FestivalMetadata | null> = computed({
    get: () => festivalState.festival?.metadata ?? null,
    set: (v) => {
      if (festivalState.festival) festivalState.festival.metadata = v
    },
  })

  const details: WritableComputedRef<FestivalDetails | null> = computed({
    get: () => festivalState.festival?.details ?? null,
    set: (v) => {
      if (festivalState.festival && v) festivalState.festival.details = v
    },
  })

  const checkedInCount = computed(
    () => festivalState.festival?.attendees.filter((a) => a.isCheckedIn).length ?? 0,
  )
  const sessionCount = computed(() => festivalState.sessions.length)

  const status = computed(() => {
    const d = festivalState.festival?.details
    if (!d) return 'upcoming'
    if (d.cancelled) return 'cancelled'
    const now = BigInt(Math.floor(Date.now() / 1000))
    if (now < d.startTime) return 'upcoming'
    if (now > d.endTime) return 'ended'
    return 'active'
  })

  const isLoading = computed(() => festivalState.loading)
  const error = computed(() => festivalState.error)

  function reload(): Promise<void> {
    const wallet = useWalletStore()
    const userH160 = wallet.isConnected ? walletAddressToH160(wallet.address) : null
    const addr = (festivalState.festival?.address ?? _address) as `0x${string}`
    return bootLoadAdmin(addr, userH160)
  }

  return { metadata, details, checkedInCount, sessionCount, status, isLoading, error, reload }
}
