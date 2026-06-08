/**
 * Worker-native chain + Bulletin read layer — every read goes through the host.
 *
 * Constraint A: the worker never touches the network itself. Two host-routed
 * transports, no gateway, no fetch():
 *
 *   1. Contract reads — `createPapiProvider(genesisHash)` returns a JSON-RPC
 *      provider the host services in its trusted Electron context
 *      (handleChainConnection). We use PAPI's untyped `getUnsafeApi()` so no
 *      generated descriptors / ABIs / viem are bundled (constraint B).
 *
 *   2. Bulletin blobs — `@parity/product-sdk-cloud-storage`'s `queryJson`
 *      resolves content through `getPreimageManager().lookup(...)`, which the
 *      host answers itself (cached). The SDK's only query strategy is the
 *      host-preimage one — it has NO HTTP fallback: it either uses the host
 *      lookup or throws `CloudStorageHostUnavailableError`. So there is
 *      deliberately no gateway URL and no `fetch()` anywhere in this bundle.
 *
 * This is not gateway-free at the protocol level (the host still fetches the
 * blob from IPFS); it moves the fetch out of the prompting sandbox into the
 * trusted, silent, cached host — which is the win.
 *
 * Deliberately does NOT reuse `@festival/shared`'s read helpers: those gate
 * host calls on `isInHost()` (window-based, false in this sandbox) and pull in
 * viem + descriptors. The worker is always inside the host, so the host
 * transports above are the only ones it needs.
 */

import { Binary, createClient, type PolkadotClient } from 'polkadot-api'
import { createPapiProvider } from '@novasamatech/host-api-wrapper'
import { hashToCid, queryJson } from '@parity/product-sdk-cloud-storage'
import { CHAIN_GENESIS_HASH, FESTIVAL_ADDRESS, READ_ONLY_ORIGIN, ZERO_BYTES32 } from './config'

/**
 * Festival getter selectors = keccak256("<sig>")[:4]. Both are no-arg
 * `view returns (bytes32)` getters, so the returned 32-byte word IS the value —
 * no ABI decode needed, just the static selector.
 */
const SELECTOR = {
  channelMetadataCid: '0xd5ec6bab',
  metadataCid: '0xff368581',
} as const

/** Minimal view of `ReviveApi.call` dry-run output (PAPI's unsafe API is untyped). */
interface ReviveCallDryRun {
  result:
    | { success: true; value: { flags: number; data: Uint8Array } }
    | { success: false }
}

let client: PolkadotClient | null = null

function getClient(): PolkadotClient {
  if (!client) client = createClient(createPapiProvider(CHAIN_GENESIS_HASH))
  return client
}

/**
 * Dry-run a no-arg Festival getter that returns a single bytes32, via
 * pallet-revive's `ReviveApi.call`. Args in runtime-API order: origin
 * (read-only AccountId), dest (H160), value, gas_limit (None),
 * storage_deposit_limit (None), input_data. (Call shape carried over from the
 * prior worker; the actual chain round-trip is exercised by the in-host live
 * test.)
 */
async function readBytes32(selector: string, label: string): Promise<`0x${string}`> {
  const dryRun = (await getClient().getUnsafeApi().apis.ReviveApi.call(
    READ_ONLY_ORIGIN,
    FESTIVAL_ADDRESS.toLowerCase(),
    0n,
    undefined,
    undefined,
    Binary.fromHex(selector),
    { at: 'best' },
  )) as ReviveCallDryRun

  if (!dryRun.result.success) throw new Error(`${label} dry-run failed`)
  if (dryRun.result.value.flags & 1) throw new Error(`${label} reverted`)
  return Binary.toHex(dryRun.result.value.data) as `0x${string}`
}

/** Read `Festival.channelMetadataCid()` → bytes32 pointer (zero when unset). */
export function readChannelMetadataCid(): Promise<`0x${string}`> {
  return readBytes32(SELECTOR.channelMetadataCid, 'channelMetadataCid')
}

/** Read `Festival.metadataCid()` → bytes32 pointer to the festival metadata doc. */
export function readMetadataCid(): Promise<`0x${string}`> {
  return readBytes32(SELECTOR.metadataCid, 'metadataCid')
}

export function isZeroCid(cid: `0x${string}`): boolean {
  return cid.toLowerCase() === ZERO_BYTES32
}

/**
 * On-chain bytes32 digest → CIDv1 string. `hashToCid` defaults to blake2b-256 +
 * raw codec — exactly the format Bulletin's TransactionStorage produces (same
 * conversion `@festival/shared` uses). Announcement body CIDs already arrive as
 * CID strings in the channel doc; this is only for the on-chain bytes32 pointers.
 */
export function bytes32ToCid(bytes32: `0x${string}`): string {
  return hashToCid(bytes32)
}

/**
 * Retrieve + JSON-parse a Bulletin blob through the host (constraint A).
 * `queryJson` reassembles chunked / DAG-PB content and is serviced by the host
 * preimage lookup — no gateway, no fetch, no fallback.
 */
export function retrieveJson<T>(cid: string): Promise<T> {
  return queryJson<T>(cid)
}
