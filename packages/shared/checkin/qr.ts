import type { CheckInPayload } from './sign'

// ── Check-In QR ──

export interface CheckInQRData {
  type: 'check-in'
  payload: CheckInPayload
  signature: string
}

export function encodeCheckInQR(payload: CheckInPayload, signature: string): string {
  const data: CheckInQRData = { type: 'check-in', payload, signature }
  return JSON.stringify(data)
}

export function decodeCheckInQR(qrData: string): CheckInQRData {
  const parsed = JSON.parse(qrData)
  if (parsed.type !== 'check-in' || !parsed.payload || !parsed.signature) {
    throw new Error('Invalid check-in QR data')
  }
  return parsed as CheckInQRData
}

export function isCheckInQR(data: unknown): data is CheckInQRData {
  return !!data && typeof data === 'object' && (data as any).type === 'check-in'
}
