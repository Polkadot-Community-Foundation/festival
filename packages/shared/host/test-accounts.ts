/**
 * Deterministic test-account identities, shared by the e2e seed script and the
 * Playwright fixtures. Values derive from the standard dev mnemonic
 * (`//<Name>` derivation); the H160 is `keccak256(publicKey)[12..32]`,
 * pallet-revive's lazy-mapping formula.
 */
export const TEST_ACCOUNTS = {
  alice: {
    uri: '//Alice',
    ss58: '5GrwvaEF5zXb26Fz9rcQpDWS57CtERHpNehXCPcNoHGKutQY',
    h160: '0x9621dde636de098b43efb0fa9b61facfe328f99d',
  },
  bob: {
    uri: '//Bob',
    ss58: '5FHneW46xGXgs5mUiveU4sbTyGBzmstUspZC92UhjJM694ty',
    h160: '0x41dccbd49b26c50d34355ed86ff0fa9e489d1e01',
  },
} as const

export type TestAccountKey = keyof typeof TEST_ACCOUNTS
