import type { PolkadotSigner } from 'polkadot-api'
import type { TxStatus } from './write'
import { writeContract } from './write'
import { FestivalSessionABI, FestivalABI } from './abis'

interface WriteOpts {
  address: `0x${string}`
  signer: PolkadotSigner
  walletAddress: string
  onStatus?: (status: TxStatus) => void
}

export async function checkInSession(
  opts: WriteOpts & { attendee: `0x${string}` },
): Promise<`0x${string}`> {
  return writeContract({
    ...opts,
    abi: FestivalSessionABI,
    functionName: 'checkIn',
    args: [opts.attendee],
  })
}

export async function manualCheckInSession(
  opts: WriteOpts & { attendee: `0x${string}` },
): Promise<`0x${string}`> {
  return writeContract({
    ...opts,
    abi: FestivalSessionABI,
    functionName: 'manualCheckIn',
    args: [opts.attendee],
  })
}

/** Cancel a session. Must be called on the Festival contract, not the session. */
export async function cancelSession(
  opts: WriteOpts & { sessionAddress: `0x${string}` },
): Promise<`0x${string}`> {
  return writeContract({
    ...opts,
    abi: FestivalABI,
    functionName: 'cancelSession',
    args: [opts.sessionAddress],
  })
}

export async function grantSessionRole(
  opts: WriteOpts & { role: `0x${string}`; account: `0x${string}` },
): Promise<`0x${string}`> {
  return writeContract({
    ...opts,
    abi: FestivalSessionABI,
    functionName: 'grantRole',
    args: [opts.role, opts.account],
  })
}

export async function revokeSessionRole(
  opts: WriteOpts & { role: `0x${string}`; account: `0x${string}` },
): Promise<`0x${string}`> {
  return writeContract({
    ...opts,
    abi: FestivalSessionABI,
    functionName: 'revokeRole',
    args: [opts.role, opts.account],
  })
}

export async function updateSessionCid(
  opts: WriteOpts & { newCid: `0x${string}` },
): Promise<`0x${string}`> {
  return writeContract({
    ...opts,
    abi: FestivalSessionABI,
    functionName: 'updateCid',
    args: [opts.newCid],
  })
}
