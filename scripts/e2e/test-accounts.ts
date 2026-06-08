/**
 * Deterministic dev accounts used by the e2e harness and the test-festival
 * seed script. Mirrors the `//Alice` / `//Bob` derivations that
 * the host test SDK produces in the Playwright fixtures, so an account
 * derived here lines up with the one the browser-side wallet
 * uses when the SPA is loaded in test mode.
 *
 * SS58 / H160 constants live in `packages/shared/host/test-accounts.ts` so
 * the Playwright fixtures (which can't pull in PAPI signer construction
 * cleanly) and the seed script (which needs full signers) share one source.
 */

import { sr25519CreateDerive } from '@polkadot-labs/hdkd'
import { entropyToMiniSecret, mnemonicToEntropy } from '@polkadot-labs/hdkd-helpers'
import { getPolkadotSigner, type PolkadotSigner } from 'polkadot-api/signer'
import { TEST_ACCOUNTS, type TestAccountKey } from '../../packages/shared/host/test-accounts'

export { TEST_ACCOUNTS, type TestAccountKey } from '../../packages/shared/host/test-accounts'

export const DEV_PHRASE =
  'bottom drive obey lake curtain smoke basket hold race lonely fit walk'

export interface TestAccount {
  key: TestAccountKey
  uri: `//${string}`
  signer: PolkadotSigner
  publicKey: Uint8Array
  ss58: string
  h160: `0x${string}`
}

const cache = new Map<TestAccountKey, TestAccount>()

export function makeTestAccount(key: TestAccountKey): TestAccount {
  const cached = cache.get(key)
  if (cached) return cached

  const miniSecret = entropyToMiniSecret(mnemonicToEntropy(DEV_PHRASE))
  const derive = sr25519CreateDerive(miniSecret)
  const keyPair = derive(TEST_ACCOUNTS[key].uri)

  const account: TestAccount = {
    key,
    uri: TEST_ACCOUNTS[key].uri,
    signer: getPolkadotSigner(keyPair.publicKey, 'Sr25519', keyPair.sign),
    publicKey: keyPair.publicKey,
    ss58: TEST_ACCOUNTS[key].ss58,
    h160: TEST_ACCOUNTS[key].h160 as `0x${string}`,
  }
  cache.set(key, account)
  return account
}
