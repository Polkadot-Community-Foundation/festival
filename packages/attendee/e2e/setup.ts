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
// Per the host test SDK README, unmapped identities fall back to
// `//Bob//${dotnsId}/${index}` derivation, which produces a different
// keypair (and H160) than the seed script's `//Bob`. That mismatch makes
// `Festival.isCheckedIn[wallet.h160]` return false even though Bob was
// checked in on-chain during seed.
const DOTNS_ID = process.env.VITE_DOTNS_ID || 'festival-attendee-dev.dot'

const { testHost } = createTestHostFixture({
  productUrl: 'http://localhost:3200',
  accounts: ['bob'],
  chain,
  productAccounts: {
    [`${DOTNS_ID}/0`]: 'bob',
  },
})

// Pre-activate the festival pass via context.addInitScript: it runs in every
// frame before the SPA's JS, so localStorage has the flag set when
// useFestivalPass first runs `readActivatedFlag`, regardless of bootLoad speed.
// A direct frame.evaluate() in the helper raced this.
import { TEST_ACCOUNTS } from '../../shared/host/test-accounts'

const FESTIVAL_ADDRESS = (process.env.VITE_FESTIVAL_ADDRESS ?? '').toLowerCase()
// useFestivalPass reads the key with `wallet.address` (SS58 from
// useWalletStore), NOT the H160-derived userAddr from useBootLoad. Match
// the SPA's storage key with Bob's SS58.
const PASS_KEY = `festivalPass:${FESTIVAL_ADDRESS}:${TEST_ACCOUNTS.bob.ss58}`

export const test = base.extend({
  page: async ({ page }, use) => {
    await page.context().addInitScript((k) => {
      try {
        window.localStorage.setItem(k, 'activated')
      } catch {
        /* private mode / quota. Fine */
      }
    }, PASS_KEY)
    await use(page)
  },
  testHost,
})
export { expect }
