const CHALLENGE_VALIDITY_MS = 5 * 60 * 1000 // 5 minutes

export interface CheckInPayload {
  type: 'check-in'
  festivalAddress: string
  ticketTokenId: number
  attendeeAddress: string
  timestamp: number
}

/**
 * Create a check-in challenge payload and sign it via the wallet.
 * The QR code displays the payload + signature for the check-in staff to scan.
 */
export async function createCheckInChallenge(
  festivalAddress: string,
  ticketTokenId: number,
  attendeeAddress: string,
  signRaw: (hexMessage: string) => Promise<string>,
): Promise<{ payload: CheckInPayload; signature: string }> {
  const payload: CheckInPayload = {
    type: 'check-in',
    festivalAddress,
    ticketTokenId,
    attendeeAddress,
    timestamp: Date.now(),
  }

  const payloadHex = '0x' + Array.from(new TextEncoder().encode(JSON.stringify(payload)))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('')

  const signature = await signRaw(payloadHex)

  return { payload, signature }
}

/** Check if a challenge timestamp is within the 5-minute validity window. */
export function isChallengeValid(timestamp: number): boolean {
  return Date.now() - timestamp < CHALLENGE_VALIDITY_MS
}
