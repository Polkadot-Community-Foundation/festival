/**
 * DotNS readiness check. Personhood status + domain ownership.
 *
 * Three view reads via the ReviveApi.call dry-run path (viem encodes calldata,
 * decodes results). Contract addresses are per-network; the personhood
 * precompile, context, and DOT_NODE are network-independent. Networks without a
 * known DotNS deployment return { supported: false }. The EVM address the reads
 * need is resolved from the chain account mapping; SS58 is the only displayed id.
 */

import { Binary } from 'polkadot-api'
import {
  concatHex,
  decodeFunctionResult,
  encodeFunctionData,
  keccak256,
  toBytes,
  type Abi,
} from 'viem'

const PERSONHOOD_PRECOMPILE = '0x000000000000000000000000000000000a010000'
const PERSONHOOD_CONTEXT =
  '0x646f746e73000000000000000000000000000000000000000000000000000000' // "dotns"
const DOT_NODE =
  '0x3fce7d1364a893e213bc4212792b517ffc88f5b13b86c8ef9c8d390c3a1370ce'

/** DotNS contract addresses for a network. */
export interface DotnsContracts {
  popRules: string
  registrar: string
}

// Update these if the DotNS deployment on a network changes.
const DOTNS_CONTRACTS_BY_NETWORK: Record<string, DotnsContracts> = {
  'paseo-next-v2': {
    popRules: '0x4909bFb3f4Fd86244abD6430fDfA0Ce5C91aD0c4',
    registrar: '0xf7Ad3F44F316C73E4a2b46b1ed48d376bCc9E639',
  },
  previewnet: {
    popRules: '0xF209a15e8a10D208bb4d3e3c56D9EB73a5934C26',
    registrar: '0x061273AeF34e8ab9Ca08E199d7440E2639Fc2088',
  },
  // PCF-fork addition: Summit DotNS deployment (summit-net-deployments register,
  // deployed 2026-06-07). Advisory only — enables the personhood/ownership read
  // when NETWORK=summit. Conflicts on `git merge upstream/main`.
  summit: {
    popRules: '0x6331e51C9AfC73BfE12562fd160BA2c66A73f984',
    registrar: '0xf3969bCBE60463302306663C62A6A8ef91ab9aA5',
  },
}

export function dotnsContractsFor(networkKey: string): DotnsContracts | null {
  return DOTNS_CONTRACTS_BY_NETWORK[networkKey] ?? null
}

// Upper-bound storage-deposit for dry-run reads; view calls never charge.
const READ_DEPOSIT = 50n * 10n ** 12n

/** Proof-of-personhood status levels. */
export const PoP = {
  NoStatus: 0,
  Lite: 1,
  Full: 2,
  Reserved: 3,
} as const

export function popStatusName(status: number): string {
  switch (status) {
    case PoP.NoStatus:
      return 'NoStatus'
    case PoP.Lite:
      return 'Lite'
    case PoP.Full:
      return 'Full'
    case PoP.Reserved:
      return 'Reserved'
    default:
      return `Unknown(${status})`
  }
}

// ── Minimal ABI fragments ──

const PERSONHOOD_ABI = [
  {
    type: 'function',
    name: 'personhoodStatus',
    stateMutability: 'view',
    inputs: [
      { name: 'account', type: 'address' },
      { name: 'context', type: 'bytes32' },
    ],
    outputs: [
      {
        name: 'info',
        type: 'tuple',
        components: [
          { name: 'status', type: 'uint8' },
          { name: 'contextAlias', type: 'bytes32' },
        ],
      },
    ],
  },
] as const satisfies Abi

const POP_RULES_ABI = [
  {
    type: 'function',
    name: 'priceWithCheck',
    stateMutability: 'view',
    inputs: [
      { name: 'name', type: 'string' },
      { name: 'userAddress', type: 'address' },
    ],
    outputs: [
      {
        name: 'metadata',
        type: 'tuple',
        components: [
          { name: 'price', type: 'uint256' },
          { name: 'status', type: 'uint8' },
          { name: 'userStatus', type: 'uint8' },
          { name: 'message', type: 'string' },
        ],
      },
    ],
  },
] as const satisfies Abi

const REGISTRAR_ABI = [
  {
    type: 'function',
    name: 'ownerOf',
    stateMutability: 'view',
    inputs: [{ name: 'tokenId', type: 'uint256' }],
    outputs: [{ name: '', type: 'address' }],
  },
] as const satisfies Abi

const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000' as const

// ── Helpers ──

/** Normalise a pallet-revive address value (Binary | hex | bytes) to 0x-hex. */
function toHexAddress(raw: unknown): `0x${string}` {
  if (typeof raw === 'string') return raw.toLowerCase() as `0x${string}`
  if (raw && typeof (raw as any).asHex === 'function') {
    return (raw as any).asHex().toLowerCase() as `0x${string}`
  }
  return ('0x' + Buffer.from(raw as Uint8Array).toString('hex')).toLowerCase() as `0x${string}`
}

/** DotNS token id for a base label: keccak256(DOT_NODE ++ keccak256(label)). */
export function computeDomainTokenId(label: string): bigint {
  const labelhash = keccak256(toBytes(label))
  const node = keccak256(concatHex([DOT_NODE, labelhash]))
  return BigInt(node)
}

/**
 * Resolve the canonical EVM (H160) address pallet-revive maps the SS58 account
 * to. Returns null if the runtime can't resolve it (e.g. account not yet
 * mapped, or no pallet-revive on this chain).
 */
export async function resolveEvmAddress(
  api: any,
  ss58: string,
): Promise<`0x${string}` | null> {
  try {
    const raw = await api.apis.ReviveApi.address(ss58)
    const hex = toHexAddress(raw)
    return hex === ZERO_ADDRESS ? null : hex
  } catch {
    return null
  }
}

/** Read a contract view function via the pallet-revive dry-run path. */
async function readView(
  api: any,
  contract: string,
  abi: Abi,
  functionName: string,
  args: unknown[],
  origin: string,
): Promise<unknown> {
  const calldata = encodeFunctionData({ abi, functionName, args })
  const dry = await api.apis.ReviveApi.call(
    origin,
    contract.toLowerCase(),
    0n,
    undefined,
    READ_DEPOSIT,
    Binary.fromHex(calldata),
  )
  if (!dry.result.success || (dry.result.value.flags & 1)) {
    throw new Error(`${functionName}() reverted`)
  }
  const data = Binary.toHex(dry.result.value.data) as `0x${string}`
  if (data === '0x') {
    throw new Error(`${functionName}() returned empty (no contract code at ${contract}?)`)
  }
  return decodeFunctionResult({ abi, functionName, data })
}

// ── Public API ──

export interface DotnsReadiness {
  /** False when the DotNS contracts/precompile aren't present on this network. */
  supported: boolean
  label: string
  /** True when the signer's mapped EVM address owns this domain. */
  owned: boolean
  /** Current owner (0x), or null when unregistered/unsupported. */
  owner: `0x${string}` | null
  /** True when the label is not yet registered (available to register). */
  available: boolean
  /** PoP level the label requires (see PoP). */
  requiredStatus: number
  /** Signer's current PoP level. */
  userStatus: number
  /** Registration price in wei (chain EVM units). */
  price: bigint
  /** Human-readable note from the rules contract. */
  message: string
  /** False when the SS58 isn't account-mapped on-chain yet. */
  mapped: boolean
  /** True when userStatus already clears requiredStatus. */
  meetsRequirement: boolean
}

/**
 * Personhood level + ownership for `label` (bare base name, no ".dot"). Returns
 * { supported: false } rather than throwing when DotNS isn't present.
 */
export async function checkDotnsReadiness(opts: {
  api: any
  ss58: string
  label: string
  networkKey: string
  /** Override addresses (e.g. for a custom chain). Falls back to the registry. */
  contracts?: DotnsContracts | null
}): Promise<DotnsReadiness> {
  const { api, ss58, label, networkKey } = opts

  const evm = await resolveEvmAddress(api, ss58)
  const acct = evm ?? ZERO_ADDRESS

  const result: DotnsReadiness = {
    supported: true,
    label,
    owned: false,
    owner: null,
    available: false,
    requiredStatus: PoP.NoStatus,
    userStatus: PoP.NoStatus,
    price: 0n,
    message: '',
    mapped: evm !== null,
    meetsRequirement: false,
  }

  // Explicit override (custom chain) or the per-network registry; none → skip.
  const contracts = opts.contracts ?? dotnsContractsFor(networkKey)
  if (!contracts) return { ...result, supported: false }

  // Required level + user level + price in one read; also confirms DotNS is present.
  try {
    const meta = (await readView(
      api,
      contracts.popRules,
      POP_RULES_ABI,
      'priceWithCheck',
      [label, acct],
      ss58,
    )) as { price: bigint; status: number; userStatus: number; message: string }
    result.price = BigInt(meta.price)
    result.requiredStatus = Number(meta.status)
    result.userStatus = Number(meta.userStatus)
    result.message = meta.message ?? ''
  } catch {
    return { ...result, supported: false }
  }

  // Canonical user status from the personhood precompile (best-effort).
  try {
    const info = (await readView(
      api,
      PERSONHOOD_PRECOMPILE,
      PERSONHOOD_ABI,
      'personhoodStatus',
      [acct, PERSONHOOD_CONTEXT],
      ss58,
    )) as { status: number; contextAlias: string }
    result.userStatus = Number(info.status)
  } catch {
    // keep the status read above
  }

  // Ownership; ownerOf reverts for an unregistered token → available.
  try {
    const owner = toHexAddress(
      await readView(api, contracts.registrar, REGISTRAR_ABI, 'ownerOf', [computeDomainTokenId(label)], ss58),
    )
    result.owner = owner
    result.owned = !!evm && owner === evm
    result.available = owner === ZERO_ADDRESS
  } catch {
    result.available = true
  }

  result.meetsRequirement = meetsRequirement(result.requiredStatus, result.userStatus)
  return result
}

/**
 * Whether `userStatus` clears `requiredStatus`: Full needs Full; Lite needs Lite
 * or Full; Reserved is never self-registerable; NoStatus is open to all.
 */
export function meetsRequirement(requiredStatus: number, userStatus: number): boolean {
  if (requiredStatus === PoP.Reserved) return false
  if (requiredStatus === PoP.Full) return userStatus === PoP.Full
  if (requiredStatus === PoP.Lite) return userStatus === PoP.Lite || userStatus === PoP.Full
  return true // NoStatus
}
