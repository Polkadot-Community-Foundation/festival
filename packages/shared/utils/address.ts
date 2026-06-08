/**
 * Thin re-export shim over the host SDK's address utilities.
 *
 * Local names (`ss58ToH160`, `h160ToSs58`, `isValidSs58`, `isValidEvmAddress`,
 * `shortenAddress`, `isSameAddress`) are preserved so existing import sites
 * don't need to change. `walletAddressToH160` is kept as a thin local helper.
 * It composes the SDK's `ss58ToH160` with a forced lowercase, because the
 * host SDK may surface addresses in EIP-1191 (chain-ID-aware)
 * checksum form, which viem's encoder rejects as "Invalid checksum" against
 * standard EIP-55. Lowercase matches what pallet-revive expects on the wire.
 */
export {
  ss58ToH160,
  h160ToSs58,
  isValidSs58,
  isValidH160 as isValidEvmAddress,
  truncateAddress as shortenAddress,
  addressesEqual as isSameAddress,
} from '@parity/product-sdk-address'

import { ss58ToH160, isValidH160 } from '@parity/product-sdk-address'

export function walletAddressToH160(walletAddress: string): `0x${string}` {
  const raw = isValidH160(walletAddress)
    ? (walletAddress as `0x${string}`)
    : ss58ToH160(walletAddress)
  return raw.toLowerCase() as `0x${string}`
}
