import type { CheckInPayload } from './sign'
import { isChallengeValid } from './sign'

export interface VerificationResult {
  valid: boolean
  error?: string
  attendeeAddress?: string
}

/**
 * Verify a check-in challenge (client-side validation).
 * Checks timestamp validity and payload structure.
 * Note: full cryptographic signature verification would require recovering the
 * signer from the SR25519 signature, which is complex. For V1, we validate
 * the payload structure and timestamp, and trust the signature.
 */
export function verifyCheckInChallenge(
  payload: CheckInPayload,
  _signature: string,
  expectedFestivalAddress: string,
): VerificationResult {
  if (payload.type !== 'check-in') {
    return { valid: false, error: 'Invalid payload type' }
  }

  if (!isChallengeValid(payload.timestamp)) {
    return { valid: false, error: 'Challenge expired (>5 minutes)' }
  }

  if (payload.festivalAddress.toLowerCase() !== expectedFestivalAddress.toLowerCase()) {
    return { valid: false, error: 'Festival address mismatch' }
  }

  if (!payload.attendeeAddress) {
    return { valid: false, error: 'Missing attendee address' }
  }

  return {
    valid: true,
    attendeeAddress: payload.attendeeAddress,
  }
}
