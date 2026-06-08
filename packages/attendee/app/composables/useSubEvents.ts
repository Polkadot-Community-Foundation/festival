import { computed } from 'vue'
import type { SubEventMetadata } from '@festival/shared/metadata/schemas'
import { useWalletStore } from '@festival/shared/host/wallet'
import { walletAddressToH160 } from '@festival/shared/utils/address'
import { festivalState } from '@festival/shared/cache/festival-state'
import { bootLoadAttendee } from './useBootLoad'

export interface AttendeeSubEvent {
  address: string
  creator: string
  metadata: SubEventMetadata
  registeredCount: number
  capacity: number
  startTime: number
  endTime: number
  isRegistered: boolean
  isCheckedIn: boolean
}

const DEFAULT_METADATA: SubEventMetadata = {
  version: '1.0',
  type: 'sub-event',
  name: '',
  description: '',
  location: '',
  speakers: [],
}

/**
 * Sub-events composable. Derives an `AttendeeSubEvent[]` view from
 * `festivalState.sessions`, applying the current user's registration /
 * check-in status from each session's attendees array (no extra reads).
 */
export function useSubEvents() {
  const subEvents = computed<AttendeeSubEvent[]>(() => {
    const userLower = festivalState.user.address?.toLowerCase() ?? null
    return festivalState.sessions
      .filter((s) => !s.details.cancelled)
      .map((s) => {
        const userRow = userLower
          ? s.attendees.find((a) => a.address.toLowerCase() === userLower)
          : undefined
        return {
          address: s.address,
          creator: s.details.creator,
          metadata: s.metadata ?? { ...DEFAULT_METADATA, name: `Sub-Event ${s.address.slice(0, 8)}` },
          registeredCount: Number(s.details.registeredCount),
          capacity: 0,
          startTime: Number(s.details.startTime),
          endTime: Number(s.details.endTime),
          isRegistered: Boolean(userRow),
          isCheckedIn: userRow?.isCheckedIn ?? false,
        }
      })
  })

  const isLoading = computed(() => festivalState.loading)

  function getByAddress(addr: string) {
    return subEvents.value.find((se) => se.address === addr)
  }

  /**
   * Patch a single session's metadata in festivalState. Used by
   * useSessionWatcher when MetadataUpdated fires.
   */
  function patchSession(address: string, patch: Partial<{ metadata: SubEventMetadata }>) {
    const target = address.toLowerCase()
    const entry = festivalState.sessions.find((s) => s.address.toLowerCase() === target)
    if (!entry) return
    if (patch.metadata) entry.metadata = patch.metadata
  }

  function reload(): Promise<void> {
    const wallet = useWalletStore()
    const userH160 = wallet.isConnected ? walletAddressToH160(wallet.address) : null
    return bootLoadAttendee(userH160)
  }

  return { subEvents, getByAddress, isLoading, reload, patchSession }
}
