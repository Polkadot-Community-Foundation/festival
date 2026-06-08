/**
 * Helpers for deploy scripts: parse `--env <key>` from argv, and upsert keys
 * into per-network `.env.<key>` files for both SPAs.
 *
 * The `--env` flag is a CLI shortcut that maps to the `NETWORK` env var
 * consumed by `getNetworkConfig()` in scripts/lib/network.ts. Callers that
 * want the override should call `parseEnvFlag()` and set `process.env.NETWORK`
 * BEFORE calling `getNetworkConfig()` for the first time.
 */

import { existsSync, readFileSync, writeFileSync, copyFileSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const REPO_ROOT = resolve(__dirname, '..', '..')

export type Spa = 'admin' | 'attendee'

export function parseEnvFlag(argv: string[]): string | undefined {
  const i = argv.indexOf('--env')
  if (i === -1) return undefined
  const v = argv[i + 1]
  if (!v) {
    throw new Error('--env requires a value (e.g. paseo | paseo-next-v2 | previewnet)')
  }
  return v
}

function envFilePath(spa: Spa, networkKey: string): string {
  return resolve(REPO_ROOT, 'packages', spa, `.env.${networkKey}`)
}

function exampleFilePath(spa: Spa, networkKey: string): string {
  return resolve(REPO_ROOT, 'packages', spa, `.env.${networkKey}.example`)
}

/**
 * Upsert key/value pairs into `packages/<spa>/.env.<networkKey>`.
 * Preserves comments and other lines. Creates the file by copying from
 * `.env.<networkKey>.example` if it doesn't already exist.
 *
 * Returns the absolute path of the updated file.
 */
export function upsertEnvFile(spa: Spa, networkKey: string, kv: Record<string, string>): string {
  const target = envFilePath(spa, networkKey)
  const example = exampleFilePath(spa, networkKey)

  if (!existsSync(target)) {
    if (existsSync(example)) {
      copyFileSync(example, target)
    } else {
      writeFileSync(target, '')
    }
  }

  let content = readFileSync(target, 'utf8')

  for (const [key, value] of Object.entries(kv)) {
    const line = `${key}=${value}`
    const re = new RegExp(`^${escapeRegExp(key)}=.*$`, 'm')
    if (re.test(content)) {
      content = content.replace(re, line)
    } else {
      if (content.length && !content.endsWith('\n')) content += '\n'
      content += line + '\n'
    }
  }

  writeFileSync(target, content)
  return target
}

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}
