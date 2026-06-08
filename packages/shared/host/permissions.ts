import {
  hostApi,
  requestDevicePermission as sdkRequestDevicePermission,
  requestPermission as sdkRequestPermission,
} from '@novasamatech/host-api-wrapper'
import { isInHost } from './detect'

/** Client-side cache for granted permissions. Avoids redundant host round-trips. */
const grantedCache = new Map<string, boolean>()

function cacheKey(type: string, value?: string): string {
  return value ? `${type}:${value}` : type
}

// ── Device Permissions ──────────────────────────────────────────────

/** Request camera access from the host. Returns true if granted or standalone. */
export async function requestCameraPermission(): Promise<boolean> {
  if (!isInHost()) return true

  const key = cacheKey('device', 'Camera')
  if (grantedCache.get(key)) return true

  const result = await sdkRequestDevicePermission('Camera')
  const granted = result.match(
    (val) => val,
    () => false,
  )

  if (granted) grantedCache.set(key, true)
  return granted
}

/** Request notifications permission from the host. Returns true if granted or standalone. */
export async function requestNotificationsPermission(): Promise<boolean> {
  if (!isInHost()) return true

  const key = cacheKey('device', 'Notifications')
  if (grantedCache.get(key)) return true

  const result = await sdkRequestDevicePermission('Notifications')
  const granted = result.match(
    (val) => val,
    () => false,
  )

  if (granted) grantedCache.set(key, true)
  return granted
}

// ── Remote Permissions ──────────────────────────────────────────────

/**
 * Request permission for outbound network access to the given hostname patterns
 * (e.g. `['paseo-ipfs.polkadot.io']`, `['*.example.com']`). One-time grant per
 * pattern set, persisted by the host.
 *
 * Advisory in current iframe/desktop hosts. Direct browser `fetch()` is not
 * intercepted at the network level. iOS blocks outbound regardless. The
 * preimage-first strategy in `metadata/bulletin.ts` remains the primary path
 * for metadata retrieval; this helper is for opt-in declarations only.
 *
 * Note: the host gates `remote_chain_transaction_broadcast` internally
 * (see `contracts/write.ts`), so there is no pre-request helper for it.
 */
export async function requestRemoteAccess(domains: string[]): Promise<boolean> {
  if (!isInHost()) return true

  const key = cacheKey('remote', domains.slice().sort().join(','))
  if (grantedCache.get(key)) return true

  const result = await sdkRequestPermission({ tag: 'Remote', value: domains })
  const granted = result.match(
    (val) => val,
    () => false,
  )

  if (granted) grantedCache.set(key, true)
  return granted
}

// ── Feature Check ───────────────────────────────────────────────────

/** Check if the host supports a given chain (by genesis hash). */
export async function checkChainSupported(genesis: `0x${string}`): Promise<boolean> {
  if (!isInHost()) return true

  const result = await hostApi.featureSupported({
    tag: 'v1',
    value: { tag: 'Chain', value: genesis },
  })

  return result.match(
    (res) => res.value,
    () => false,
  )
}
