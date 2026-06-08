import type { ChannelMetadata } from './schemas'
import { useBulletinStorage } from './bulletin'
import { isNonZeroCid, readChannelMetadataCid } from '../contracts/festival-reads'

/**
 * Read the on-chain `channelMetadataCid` and resolve the channel JSON from
 * Bulletin Chain. Returns the CID alongside the channel doc (or null if the
 * pointer is unset). Callers handle their own loading / error refs.
 *
 * Shared between admin (which mutates the channel) and attendee (which only
 * reads it); both apps need identical decoding semantics.
 */
export async function loadChannelFromChain(
  festivalAddress: `0x${string}`,
): Promise<{ cid: `0x${string}`; channel: ChannelMetadata | null }> {
  const cid = await readChannelMetadataCid(festivalAddress)
  if (!isNonZeroCid(cid)) {
    return { cid, channel: null }
  }
  const { retrievePlaintext } = useBulletinStorage()
  const channel = await retrievePlaintext<ChannelMetadata>(cid)
  return { cid, channel }
}
