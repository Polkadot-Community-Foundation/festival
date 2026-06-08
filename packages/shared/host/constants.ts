import { resolveNetwork } from './networks'

const env = (import.meta as any).env || {}

const network = resolveNetwork(env.VITE_NETWORK, {
  mainGenesisHash: env.VITE_CHAIN_GENESIS_HASH,
  bulletinGenesisHash: env.VITE_BULLETIN_GENESIS_HASH
})

if (!network.bulletinChain) {
  // Bulletin is required by current app code paths (storage, signer, etc.).
  // Future networks without bulletin must update those call sites first.
  throw new Error(`Network "${network.key}" has no bulletin chain configured`)
}

if (!network.mainChain.genesisHash) {
  throw new Error(
    `Main chain genesis hash missing for network "${network.key}". ` +
    `Set VITE_CHAIN_GENESIS_HASH or run \`bun run sync-network\` to populate it.`
  )
}

if (!network.bulletinChain.genesisHash) {
  throw new Error(
    `Bulletin chain genesis hash missing for network "${network.key}". ` +
    `Set VITE_BULLETIN_GENESIS_HASH or run \`bun run sync-network\` to populate it.`
  )
}

/** Substrate WSS endpoint. Used by PAPI for pallet_revive extrinsics */
export const SUBSTRATE_WS_URL = network.mainChain.wsUrl

/** Asset Hub genesis hash. Used by createPapiProvider for host-routed RPC */
export const CHAIN_GENESIS_HASH = network.mainChain.genesisHash as `0x${string}`

/** Bulletin Chain constants for off-chain metadata storage */
export const BULLETIN_RPC = network.bulletinChain.wsUrl
export const BULLETIN_GENESIS_HASH = network.bulletinChain.genesisHash as `0x${string}`
export const IPFS_GATEWAY = network.ipfsGateway

/** Active network metadata. Exported for UI/diagnostics surfaces. */
export const ACTIVE_NETWORK = network

/** ~7 day retention in blocks */
export const RETENTION_BLOCKS = 100_800
/** Storage transaction timeout (3 minutes) */
export const STORE_TIMEOUT_MS = 180_000

/**
 * Batch size for parallel preimage fetches against the host. The host applies
 * a rate limit to preimage requests (dropping on overflow); fetching
 * 10-at-a-time with an await between groups keeps each burst under the cap and
 * lets the token bucket refill before the next batch fires.
 */
export const PREIMAGE_FETCH_CHUNK_SIZE = 10

/** DotNS identifier for the current SPA's product account. Per-SPA env var with dev fallback. */
export const DOTNS_ID = ((import.meta as any).env?.VITE_DOTNS_ID || 'web3summit.dot') as string

/** Native token config. Sourced from the active network registry entry. */
export const NATIVE_TOKEN_SYMBOL = network.nativeToken.symbol
export const NATIVE_TOKEN_DECIMALS = network.nativeToken.decimals

/**
 * Read-only origin for dry-run calls that don't need a sender context.
 * This is an EVM-derived AccountId32 (H160=0x00…00, last 12 bytes=0xEE).
 * pallet-revive recognizes EVM-derived accounts as mapped without needing map_account().
 */
export const READ_ONLY_ORIGIN = '5C4hrfjw9DjXZTzV3MwzrrAr9P1MLDHajjSidz9bR544LEq1'
