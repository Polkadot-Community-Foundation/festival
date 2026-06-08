import { shortenAddress } from '../utils/address'
import type { WalletAccount } from '../host/wallet'

/**
 * Resolve a display name for an address.
 * V1: checks connected accounts by address match, falls back to shortened address.
 * V2 will add People Chain resolution.
 */
export function resolveDisplayName(
  address: string,
  connectedAccounts: WalletAccount[],
): string {
  const match = connectedAccounts.find(
    (a) => a.address.toLowerCase() === address.toLowerCase(),
  )
  if (match?.name) return match.name
  return shortenAddress(address)
}
