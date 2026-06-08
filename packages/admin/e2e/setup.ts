import { test as base, expect } from '@playwright/test'
import { createTestHostFixture } from '@parity/host-api-test-sdk/playwright'
import { resolveNetwork } from '../../shared/host/networks'

// Build the test SDK's ChainConfig from VITE_NETWORK + VITE_CHAIN_GENESIS_HASH
// so the e2e harness targets whichever chain the SPA was built for. Without
// this, tests would silently hit the default `PASEO_ASSET_HUB` even when the
// build is pinned to paseo-next-v2 / previewnet, and contract reads would fail.
const network = resolveNetwork(process.env.VITE_NETWORK, {
  mainGenesisHash: process.env.VITE_CHAIN_GENESIS_HASH,
  bulletinGenesisHash: process.env.VITE_BULLETIN_GENESIS_HASH,
})

if (!network.mainChain.genesisHash) {
  throw new Error(
    `e2e setup: network "${network.key}" has no main-chain genesis hash. ` +
      `Run \`scripts/sync-network.ts\` before \`npm run test:e2e:*\` to populate it.`,
  )
}

const chain = {
  id: network.key,
  name: network.displayName,
  genesisHash: network.mainChain.genesisHash,
  rpcUrl: network.mainChain.wsUrl,
  tokenSymbol: network.nativeToken.symbol,
  tokenDecimals: network.nativeToken.decimals,
}

// `productAccounts` keys must be the FULL `${dotnsId}/${derivationIndex}`.
// Unmapped identities fall back to `//Alice//${dotnsId}/${index}` derivation
// (per the host test SDK README), giving the SPA a different
// keypair than the seed script's `//Alice` / `//Bob`. Tests then fail to
// see the role grants we did in seed.
const DOTNS_ID = process.env.VITE_DOTNS_ID || 'festival-admin-dev.dot'

const { testHost } = createTestHostFixture({
  productUrl: 'http://localhost:3100',
  accounts: ['alice', 'bob'],
  chain,
  productAccounts: {
    [`${DOTNS_ID}/0`]: 'alice',
    [`${DOTNS_ID}/1`]: 'bob',
  },
})

export const test = base.extend({ testHost })
export { expect }
