import { CID } from 'multiformats/cid'
import { calculateCid, cidToPreimageKey, hashToCid, parseCid } from '@parity/product-sdk-bulletin'
import { IPFS_GATEWAY } from '../host/constants'

/**
 * Compute a CIDv1 (blake2b-256 + raw codec) for arbitrary data.
 * This matches the CID that Bulletin Chain's TransactionStorage pallet produces.
 *
 * Async because the SDK's `calculateCid` uses Web Crypto for blake2b on web
 * platforms.
 */
export function computeCid(data: Uint8Array): Promise<CID> {
  return calculateCid(data)
}

/**
 * Extract the 32-byte digest from a CID for on-chain bytes32 storage.
 * Only the digest is stored. The CID version, codec, and hash code are implicit.
 */
export function cidToBytes32(cid: CID): `0x${string}` {
  return cidToPreimageKey(cid.toString())
}

/**
 * Reconstruct a full CIDv1 from an on-chain bytes32 digest.
 * Assumes blake2b-256 hash + raw codec (the only format this app uses).
 */
export function bytes32ToCid(bytes32: `0x${string}`): CID {
  return parseCid(hashToCid(bytes32))
}

/**
 * Build an IPFS gateway URL for a CID.
 */
export function cidToGatewayUrl(cid: CID | string): string {
  const cidStr = typeof cid === 'string' ? cid : cid.toString()
  return `${IPFS_GATEWAY}/ipfs/${cidStr}`
}
