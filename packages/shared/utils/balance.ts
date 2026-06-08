import { NATIVE_TOKEN_DECIMALS, NATIVE_TOKEN_SYMBOL } from '../host/constants'

/** Format a balance for display. E.g., 10000000000n → "1 PAS" */
export function formatBalance(
  amount: bigint,
  decimals = NATIVE_TOKEN_DECIMALS,
  symbol = NATIVE_TOKEN_SYMBOL,
): string {
  const divisor = 10n ** BigInt(decimals)
  const whole = amount / divisor
  const remainder = amount % divisor

  if (remainder === 0n) {
    return `${whole.toLocaleString()} ${symbol}`
  }

  // Show up to 4 decimal places
  const fracStr = remainder.toString().padStart(decimals, '0').slice(0, 4).replace(/0+$/, '')
  return `${whole.toLocaleString()}.${fracStr} ${symbol}`
}

/** Parse a display balance back to bigint. */
export function parseBalance(
  display: string,
  decimals = NATIVE_TOKEN_DECIMALS,
): bigint {
  const cleaned = display.replace(/[^0-9.]/g, '')
  const [whole = '0', frac = ''] = cleaned.split('.')
  const paddedFrac = frac.padEnd(decimals, '0').slice(0, decimals)
  return BigInt(whole) * 10n ** BigInt(decimals) + BigInt(paddedFrac)
}
