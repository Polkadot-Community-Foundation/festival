# End-to-end tests on revive

Hardhat + `@parity/hardhat-polkadot` + viem.

The forge suite in `../test/` validates Solidity logic on a stock EVM (revm).
This suite compiles the same `../src/` Solidity via `resolc` and exercises it
on a real revive ETH-RPC — that's where `pallet-revive` translation bugs
actually surface.

## Layout

Hardhat's project root is the parent (`contracts/`) so it can resolve sources
in `../src/`. The hardhat config, `package.json`, `tsconfig.json` and
`node_modules` live one level up; only the test files and helpers live here.

```
contracts/
├── package.json          # hardhat deps
├── hardhat.config.ts
├── tsconfig.json
├── src/                  # existing solidity sources (compiled by both forge and resolc)
└── e2e/
    ├── README.md         # ← you are here
    ├── test/             # hardhat-viem test files
    ├── cache/            # hardhat compile cache (gitignored)
    └── artifacts/        # resolc output (gitignored)
```

## Local run (three terminals)

The local revive stack lives in [`0xRVE/revive-solo`](https://github.com/0xRVE/revive-solo) — clone it once.

```bash
# Terminal 1 — polkadot-omni-node on :9944
cd path/to/revive-solo && ./scripts/start-node.sh

# Terminal 2 — eth-rpc on :8545
cd path/to/revive-solo && ./scripts/start-eth-rpc.sh

# Terminal 3 — tests
cd contracts
npm install          # first time only
npm test             # against local node
npm run test:testnet # against Polkadot Hub TestNet (needs PRIVATE_KEY)
```

## CI

[`.github/workflows/contracts.yml`](../../.github/workflows/contracts.yml) runs
this same suite on every PR. It downloads the SDK binaries from the
`polkadot-stable2603` release and the runtime WASM from `0xRVE/revive-solo`'s
GitHub Release — no `cargo build` in CI.

## Helpers (`test/helpers.ts`)

- `sendWithRetry(label, sendFn)` — sends a tx and waits for the receipt.
  **Always use this for writes.** `contract.write.X()` resolves with the tx
  hash, not the receipt; reading state back immediately races the inclusion.
- `waitForNextBlock()` — polls `eth_blockNumber` until it advances.
- `expectTxReverts(signer, params, msg?)` — handles both simulation-time
  (eth_call) and receipt-time (`status: "reverted"`) revert paths.

## Why no `loadFixture`?

`loadFixture` (from `@nomicfoundation/hardhat-network-helpers`) snapshots and
reverts state between tests. That works on hardhat's in-memory EVM; it
doesn't work against a real revive node. Each test deploys fresh contracts
and accepts that the chain progresses. Slower, but actually tests revive.
