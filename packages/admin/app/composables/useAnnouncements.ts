import { ref, computed } from 'vue'
import type { ChannelMetadata, AnnouncementBody } from '@festival/shared/metadata/schemas'
import { CHANNEL_ANNOUNCEMENT_SOFT_CAP } from '@festival/shared/metadata/constants'
import type { TxStatus } from '@festival/shared/contracts/write'
import { writeContract } from '@festival/shared/contracts/write'
import { FestivalABI } from '@festival/shared/contracts/abis'
import { useBulletinStorage } from '@festival/shared/metadata/bulletin'
import { loadChannelFromChain } from '@festival/shared/metadata/channel'
import { readChannelMetadataCid } from '@festival/shared/contracts/festival-reads'
import { formatTxError } from '@festival/shared/contracts/errors'
import { useWalletStore } from '@festival/shared/host/wallet'

/**
 * Phases shown on the send button. Distinct from `TxStatus` because the
 * bulletin writes (which dominate the wait) don't surface through the
 * contract-tx status callback.
 */
export type SendStep =
  | 'idle'
  | 'saving'              // bulletin write: announcement body
  | 'updating-channel'    // bulletin write: updated channel doc
  | 'sending'             // contract tx: signature → inclusion

export class ChannelConflictError extends Error {
  constructor() {
    super('Another admin updated the channel since you loaded it. Reload and try again.')
    this.name = 'ChannelConflictError'
  }
}

export function useAnnouncements(festivalAddress: string) {
  const channel = ref<ChannelMetadata | null>(null)
  const channelCid = ref<`0x${string}` | null>(null)
  const isLoading = ref(false)
  const isSending = ref(false)
  const txStatus = ref<TxStatus>('idle')
  const sendStep = ref<SendStep>('idle')
  const error = ref<string | null>(null)

  const announcements = computed<string[]>(() => channel.value?.announcements ?? [])

  async function loadChannel() {
    isLoading.value = true
    error.value = null
    try {
      const { cid, channel: doc } = await loadChannelFromChain(festivalAddress as `0x${string}`)
      channelCid.value = cid
      channel.value = doc
    } catch (e: any) {
      error.value = e?.message ?? String(e)
      console.error('[useAnnouncements] loadChannel failed:', e)
    } finally {
      isLoading.value = false
    }
  }

  /**
   * Send an announcement: guard against a concurrent channel update, upload the
   * body to Bulletin Chain, append its CID to the channel doc (dropping the
   * oldest past the soft cap), then point the contract at the new channel CID.
   *
   * The full channel JSON is re-uploaded each call (O(N) in announcement count),
   * but entries are small base58 CIDs so even a 500-entry channel is ~30 KB.
   *
   * Security: AnnouncementBody.senderName / senderAddress are client-set and not
   * verifiable from the body. The on-chain tx signer is authoritative; the UI
   * must not present these fields as cryptographic attribution.
   */
  async function sendAnnouncement(
    input: { content: string; senderName?: string },
  ): Promise<void> {
    if (!channel.value) throw new Error('Channel not loaded')

    isSending.value = true
    error.value = null
    txStatus.value = 'preparing'
    sendStep.value = 'saving'
    try {
      const wallet = useWalletStore()
      const { storePlaintext } = useBulletinStorage()

      // Optimistic-concurrency guard.
      const onChainCid = await readChannelMetadataCid(festivalAddress as `0x${string}`)
      if (channelCid.value && onChainCid !== channelCid.value) {
        throw new ChannelConflictError()
      }

      const body: AnnouncementBody = {
        content: input.content,
        timestamp: Date.now(),
        senderName: input.senderName,
        senderAddress: wallet.address || undefined,
      }
      const { cid: bodyCid } = await storePlaintext(body)

      // Append CID and re-upload channel doc (drop oldest if over cap).
      sendStep.value = 'updating-channel'
      const nextAnnouncements = [...channel.value.announcements, bodyCid]
      let droppedCount = 0
      while (nextAnnouncements.length > CHANNEL_ANNOUNCEMENT_SOFT_CAP) {
        nextAnnouncements.shift()
        droppedCount++
      }
      if (droppedCount > 0) {
        console.warn(
          `[useAnnouncements] Channel exceeded soft cap (${CHANNEL_ANNOUNCEMENT_SOFT_CAP}); dropped ${droppedCount} oldest announcement(s).`,
        )
      }
      const nextChannel: ChannelMetadata = {
        ...channel.value,
        announcements: nextAnnouncements,
      }
      const { bytes32: newChannelCid } = await storePlaintext(nextChannel)

      // Sign the on-chain pointer update. `in-block` is treated as done so the
      // UI returns to idle; the promise keeps awaiting finalization in the
      // background, and finalization failures (e.g. reorg) are logged only.
      txStatus.value = 'signing'
      sendStep.value = 'sending'
      let optimisticallyResolved = false
      try {
        await writeContract({
          address: festivalAddress as `0x${string}`,
          abi: FestivalABI,
          functionName: 'updateChannelMetadataCid',
          args: [newChannelCid],
          signer: wallet.getSigner(),
          walletAddress: wallet.address,
          onStatus: (s) => {
            txStatus.value = s
            if (s === 'in-block') {
              channel.value = nextChannel
              channelCid.value = newChannelCid
              optimisticallyResolved = true
              isSending.value = false
              sendStep.value = 'idle'
            }
          },
        })
      } catch (e) {
        if (!optimisticallyResolved) throw e
        console.warn('[useAnnouncements] finalization failed after in-block', e)
      }
    } catch (e: any) {
      txStatus.value = 'error'
      error.value = e instanceof ChannelConflictError ? e.message : formatTxError(e)
      throw e
    } finally {
      isSending.value = false
      sendStep.value = 'idle'
    }
  }

  return {
    channel,
    channelCid,
    announcements,
    isLoading,
    isSending,
    txStatus,
    sendStep,
    error,
    loadChannel,
    sendAnnouncement,
  }
}
