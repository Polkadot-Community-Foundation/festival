import { ref, computed } from 'vue'
import { MOCK_ATTENDEES } from '@festival/shared/mocks'
import { hasDeployedContracts } from '@festival/shared/contracts/festival-reads'
import { h160ToSs58, walletAddressToH160 } from '@festival/shared/utils/address'
import { useWalletStore } from '@festival/shared/host/wallet'
import { festivalState } from '@festival/shared/cache/festival-state'
import { bootLoadAdmin } from './useBootLoad'

export interface CheckedInAttendee {
  address: `0x${string}`
  checkedInAt: number
}

/**
 * Attendees composable. Derives `CheckedInAttendee[]` from the POAP data
 * already fetched by bootLoadAdmin (each POAP entry's `issuedAt` is the
 * check-in timestamp). Sorted most-recent-first to match prior behavior.
 */
export function useAttendees(festivalAddress: string) {
  const search = ref('')

  const attendees = computed<CheckedInAttendee[]>(() => {
    if (!hasDeployedContracts()) {
      const now = Math.floor(Date.now() / 1000)
      return MOCK_ATTENDEES
        .filter((a) => a.isCheckedIn)
        .map((a, i) => ({
          address: a.address as `0x${string}`,
          checkedInAt: now - (i + 1) * 600,
        }))
    }
    return festivalState.user.festivalPoaps
      .map((p) => ({
        address: p.data.attendee,
        checkedInAt: Number(p.data.issuedAt),
      }))
      .sort((a, b) => b.checkedInAt - a.checkedInAt)
  })

  const filtered = computed(() => {
    const q = search.value.trim().toLowerCase()
    if (!q) return attendees.value
    return attendees.value.filter((a) => {
      if (a.address.toLowerCase().includes(q)) return true
      return h160ToSs58(a.address).toLowerCase().includes(q)
    })
  })

  const stats = computed(() => ({ checkedIn: attendees.value.length }))
  const isLoading = computed(() => festivalState.loading)

  function reload(): Promise<void> {
    const wallet = useWalletStore()
    const userH160 = wallet.isConnected ? walletAddressToH160(wallet.address) : null
    return bootLoadAdmin(festivalAddress as `0x${string}`, userH160)
  }

  return { attendees, filtered, search, stats, isLoading, reload }
}
