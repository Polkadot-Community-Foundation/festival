/**
 * Resume state, persisted at `.deploy/state.<network>.json`, so a re-run skips
 * steps that already succeeded. Non-secret; safe to delete to force a fresh run.
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const REPO_ROOT = resolve(__dirname, '..', '..')
const STATE_DIR = resolve(REPO_ROOT, '.deploy')

export type StepId =
  | 'contractsBuilt'
  | 'multicall'
  | 'festival'
  | 'rolesGranted'
  | 'frontendBuilt'
  | 'ciEnvWritten'

export interface DeployedAddresses {
  multicall?: `0x${string}`
  festival?: `0x${string}`
  festivalPoap?: `0x${string}`
  sessionPoap?: `0x${string}`
  sessionTemplate?: `0x${string}`
}

export interface DeployState {
  network: string
  steps: Partial<Record<StepId, boolean>>
  addresses: DeployedAddresses
  updatedAt?: string
}

function statePath(networkKey: string): string {
  return resolve(STATE_DIR, `state.${networkKey}.json`)
}

export function loadState(networkKey: string): DeployState {
  const path = statePath(networkKey)
  if (!existsSync(path)) {
    return { network: networkKey, steps: {}, addresses: {} }
  }
  try {
    const raw = JSON.parse(readFileSync(path, 'utf8'))
    return {
      network: networkKey,
      steps: raw.steps ?? {},
      addresses: raw.addresses ?? {},
      updatedAt: raw.updatedAt,
    }
  } catch {
    // Corrupt state should never block a deploy. Start fresh.
    return { network: networkKey, steps: {}, addresses: {} }
  }
}

export function saveState(state: DeployState): string {
  if (!existsSync(STATE_DIR)) mkdirSync(STATE_DIR, { recursive: true })
  const path = statePath(state.network)
  const out: DeployState = { ...state, updatedAt: new Date().toISOString() }
  writeFileSync(path, JSON.stringify(out, null, 2) + '\n')
  return path
}

export function isDone(state: DeployState, step: StepId): boolean {
  return state.steps[step] === true
}

/** Mark a step done, merge any newly-known addresses, and persist. */
export function markDone(
  state: DeployState,
  step: StepId,
  addresses: Partial<DeployedAddresses> = {},
): DeployState {
  state.steps[step] = true
  state.addresses = { ...state.addresses, ...addresses }
  saveState(state)
  return state
}
