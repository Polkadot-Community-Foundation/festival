import { computed, type WritableComputedRef } from 'vue'
import type { FestivalMetadata } from '@festival/shared/metadata/schemas'
import type { FestivalDetails } from '@festival/shared/contracts/types'
import { festivalState } from '@festival/shared/cache/festival-state'
import { bootLoadAttendee } from './useBootLoad'
import { useWalletStore } from '@festival/shared/host/wallet'
import { walletAddressToH160 } from '@festival/shared/utils/address'
import { FESTIVAL_ADDRESS } from '@festival/shared/contracts/addresses'

/**
 * Festival composable. Thin selectors over festivalState; loading is owned by
 * `bootLoadAttendee` and the watcher mutates festivalState directly.
 *
 * `metadata` and `details` are writable computed so the watcher's ref-write
 * path keeps working until it mutates state directly.
 */
export function useFestival() {
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

  const isLoading = computed(() => festivalState.loading)
  const error = computed(() => festivalState.error)

  function reload(): Promise<void> {
    const wallet = useWalletStore()
    const userH160 = wallet.isConnected ? walletAddressToH160(wallet.address) : null
    return bootLoadAttendee(userH160)
  }

  return { festivalAddress: FESTIVAL_ADDRESS, metadata, details, isLoading, error, reload }
}
