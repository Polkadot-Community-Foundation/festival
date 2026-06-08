/**
 * Node-side network resolver for admin/deploy scripts.
 *
 * Mirrors the app's resolveNetwork() but reads from process.env.NETWORK:
 *
 *   NETWORK=paseo|paseo-next-v2|previewnet  (default: paseo)
 *   NETWORK=custom                          (built from CUSTOM_* env vars)
 *
 * Use dotenv before calling getNetworkConfig() if reading from a .env file.
 */

import {
  resolveNetwork,
  NETWORKS,
  type NetworkConfig,
  type NetworkKey
} from '../../packages/shared/host/networks'

export const CUSTOM_NETWORK_KEY = 'custom'

export interface CustomNetworkInput {
  displayName?: string
  mainWsUrl: string
  mainGenesisHash?: string
  bulletinWsUrl?: string
  bulletinGenesisHash?: string
  ipfsGateway?: string
  nativeSymbol?: string
  nativeDecimals?: number
  /** Optional DotNS addresses. Supply both to enable the personhood/ownership advisory. */
  dotnsPopRules?: string
  dotnsRegistrar?: string
}

/**
 * Build a NetworkConfig for a custom chain. Genesis hashes are optional (connect
 * uses wsUrl); `key` is "custom" and there's no PAPI descriptor.
 */
export function buildCustomNetworkConfig(input: CustomNetworkInput): NetworkConfig {
  if (!input.mainWsUrl) {
    throw new Error('custom network requires a main chain WebSocket URL (CUSTOM_MAIN_WS)')
  }
  return {
    key: CUSTOM_NETWORK_KEY as NetworkKey,
    displayName: input.displayName || 'Custom network',
    isTestnet: true,
    mainChain: {
      wsUrl: input.mainWsUrl,
      genesisHash: (input.mainGenesisHash || '') as `0x${string}` | '',
    },
    bulletinChain: input.bulletinWsUrl
      ? {
          wsUrl: input.bulletinWsUrl,
          genesisHash: (input.bulletinGenesisHash || '') as `0x${string}` | '',
        }
      : null,
    ipfsGateway: input.ipfsGateway || '',
    nativeToken: {
      symbol: input.nativeSymbol || 'UNIT',
      decimals: input.nativeDecimals ?? 12,
    },
  }
}

/** Read a custom-network definition from CUSTOM_* env vars (set by setup.ts). */
function customFromEnv(): CustomNetworkInput {
  return {
    displayName: process.env.CUSTOM_DISPLAY_NAME,
    mainWsUrl: process.env.CUSTOM_MAIN_WS || '',
    mainGenesisHash: process.env.CUSTOM_MAIN_GENESIS,
    bulletinWsUrl: process.env.CUSTOM_BULLETIN_WS,
    bulletinGenesisHash: process.env.CUSTOM_BULLETIN_GENESIS,
    ipfsGateway: process.env.CUSTOM_IPFS_GATEWAY,
    nativeSymbol: process.env.CUSTOM_NATIVE_SYMBOL,
    nativeDecimals: process.env.CUSTOM_NATIVE_DECIMALS
      ? Number(process.env.CUSTOM_NATIVE_DECIMALS)
      : undefined,
  }
}

let cached: NetworkConfig | null = null

/**
 * Resolve the active network for a Node script. Cached after first call.
 * Mirrors the browser-side override pass-through in `packages/shared/host/constants.ts`
 * so scripts that read `genesisHash` get the same value the app would (and the
 * same fail-loud behavior when neither registry nor env provides one).
 *
 * NETWORK=custom builds the config from CUSTOM_* env vars instead of the registry.
 */
export function getNetworkConfig(): NetworkConfig {
  if (cached) return cached
  if (process.env.NETWORK === CUSTOM_NETWORK_KEY) {
    cached = buildCustomNetworkConfig(customFromEnv())
  } else {
    cached = resolveNetwork(process.env.NETWORK, {
      mainGenesisHash: process.env.VITE_CHAIN_GENESIS_HASH,
      bulletinGenesisHash: process.env.VITE_BULLETIN_GENESIS_HASH,
    })
  }
  return cached
}

export { NETWORKS }
export type { NetworkConfig, NetworkKey }
