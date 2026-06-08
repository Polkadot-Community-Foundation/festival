import { createClient, type PolkadotClient } from 'polkadot-api'
import { getWsProvider } from 'polkadot-api/ws'
import { createPapiProvider } from '@novasamatech/host-api-wrapper'
import { mainDescriptor, bulletinDescriptor } from '#active-descriptors'
import {
  SUBSTRATE_WS_URL,
  CHAIN_GENESIS_HASH,
  BULLETIN_RPC,
  BULLETIN_GENESIS_HASH,
} from './constants'
import { isInHost } from './detect'

// Cache PAPI clients per genesis hash to prevent in-flight chainHead events
// from a destroyed client corrupting a new client's block tree.
const clientCache = new Map<string, PolkadotClient>()
let bulletinClientInstance: PolkadotClient | null = null

/**
 * Get or create a PAPI client for a given chain genesis hash.
 * Host mode: routed via createPapiProvider (through host sandbox).
 * Standalone mode: direct WebSocket connection.
 */
function getOrCreateClient(genesis: `0x${string}`): PolkadotClient {
  let client = clientCache.get(genesis)
  if (!client) {
    const provider = isInHost()
      ? createPapiProvider(genesis)
      : getWsProvider(SUBSTRATE_WS_URL)

    client = createClient(provider)
    clientCache.set(genesis, client)
  }
  return client
}

/**
 * Main chain PAPI client (Polkadot Hub TestNet).
 * Cached per genesis hash for reuse.
 */
export function useMainClient() {
  const client = getOrCreateClient(CHAIN_GENESIS_HASH)
  return {
    client,
    api: client.getTypedApi(mainDescriptor),
  }
}

/**
 * Bulletin Chain PAPI client.
 * Host mode: routed via createPapiProvider on the bulletin genesis hash.
 * Standalone mode: direct WebSocket to BULLETIN_RPC.
 */
export function useBulletinClient() {
  if (!bulletinClientInstance) {
    const provider = isInHost()
      ? createPapiProvider(BULLETIN_GENESIS_HASH)
      : getWsProvider(BULLETIN_RPC)
    bulletinClientInstance = createClient(provider)
  }
  return {
    client: bulletinClientInstance,
    api: bulletinClientInstance.getTypedApi(bulletinDescriptor),
  }
}
