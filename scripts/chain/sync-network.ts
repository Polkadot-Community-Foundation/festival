/**
 * Fetch the live genesis hash for the active network's main + bulletin chains
 * and emit them as VITE_* env-var assignments to stdout.
 *
 * Usage:
 *   NETWORK=previewnet npx tsx scripts/chain/sync-network.ts >> "$GITHUB_ENV"
 *   NETWORK=previewnet npx tsx scripts/chain/sync-network.ts > .env.local
 *
 * Previewnet is rebuilt frequently, so a compile-time genesis hash goes stale
 * fast; run this before dev/build to bake live values into the bundle. Paseo's
 * hashes are stable and live in the registry, so running it there just re-emits
 * the same values.
 */

import { resolveNetwork } from '../../packages/shared/host/networks'

const FETCH_TIMEOUT_MS = 10_000

function fetchGenesis(wsUrl: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(wsUrl)
    const timer = setTimeout(() => {
      ws.close()
      reject(new Error(`timed out after ${FETCH_TIMEOUT_MS}ms: ${wsUrl}`))
    }, FETCH_TIMEOUT_MS)

    ws.addEventListener('open', () => {
      ws.send(
        JSON.stringify({
          jsonrpc: '2.0',
          id: 1,
          method: 'chain_getBlockHash',
          params: [0],
        }),
      )
    })

    ws.addEventListener('message', (event: MessageEvent) => {
      clearTimeout(timer)
      ws.close()
      try {
        const r = JSON.parse(event.data.toString())
        if (r.error) reject(new Error(`rpc error: ${JSON.stringify(r.error)}`))
        else if (typeof r.result !== 'string')
          reject(new Error(`unexpected response: ${JSON.stringify(r)}`))
        else resolve(r.result)
      } catch (e) {
        reject(new Error(`parse error: ${(e as Error).message}`))
      }
    })

    ws.addEventListener('error', () => {
      clearTimeout(timer)
      reject(new Error(`ws connection error: ${wsUrl}`))
    })
  })
}

async function main() {
  const networkKey = process.env.NETWORK || process.env.VITE_NETWORK
  const network = resolveNetwork(networkKey)
  process.stderr.write(`Fetching live genesis for ${network.displayName}...\n`)

  const tasks: Array<Promise<string | null>> = [fetchGenesis(network.mainChain.wsUrl)]
  if (network.bulletinChain) {
    tasks.push(fetchGenesis(network.bulletinChain.wsUrl))
  } else {
    tasks.push(Promise.resolve(null))
  }

  const [mainHash, bulletinHash] = await Promise.all(tasks)

  process.stderr.write(`  main:     ${mainHash}\n`)
  if (bulletinHash) process.stderr.write(`  bulletin: ${bulletinHash}\n`)

  console.log(`VITE_CHAIN_GENESIS_HASH=${mainHash}`)
  if (bulletinHash) console.log(`VITE_BULLETIN_GENESIS_HASH=${bulletinHash}`)
}

main().catch((err: Error) => {
  console.error(`sync-network failed: ${err.message}`)
  process.exit(1)
})
