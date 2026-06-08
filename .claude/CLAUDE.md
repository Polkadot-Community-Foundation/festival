# Festival System — Conference App

## What This Project Is

A **prototype** festival-management built on Polkadot. Festivals are
on-chain events with non-transferable tickets, attendance POAPs, and composable
sessions (unconference-style sub-events). It runs inside the **Polkadot Host**
(web, desktop, mobile) — host-only, with no standalone fallback.

This is an exploratory prototype, not a production system. Treat deployed
addresses, networks, and flows as disposable testnet artifacts.

The codebase is split into two front-end SPAs sharing a common library, plus a
Solidity contract suite:

- **Admin SPA** (`packages/admin/`) — desktop-friendly. Pinned to one festival:
  check-in, schedule/map editing, role management, announcements.
- **Attendee SPA** (`packages/attendee/`) — mobile-first. Pinned to one
  festival: registration, schedule, map, sessions, badges.
- **Shared library** (`packages/shared/`) — pure TypeScript (no Vue SFCs):
  contract helpers, metadata utilities, host boot, wallet composables, PAPI
  clients, CID computation, check-in signing, the venue map engine.

Each package carries its own README with the detailed architecture; this file
is the high-level orientation and the cross-cutting rules.

## Skills

**Load and follow the relevant skill before working on its domain.** Skills
contain authoritative patterns, constraints, and gotchas that override general
knowledge. They live in `.claude/skills/`.

| Skill                      | Domain                                                     | When to use                                 |
| -------------------------- | ---------------------------------------------------------- | ------------------------------------------- |
| **tailwind-design-system** | Tailwind v4 patterns, tokens, component libraries          | Styling, design tokens, responsive patterns |
| **vue-best-practices**     | Composition API, `<script setup>`, TypeScript, Pinia, Nuxt | Any Vue/Nuxt code                           |
| **vue-debug-guides**       | Runtime errors, warnings, async failures, SSR/hydration    | Debugging Vue issues                        |
| **skill-creator**          | Creating or updating skills                                | When a new skill is needed                  |

The Polkadot-specific guidance comes from the **`product-sdk`** plugin (below).
Multiple skills can be active at once (e.g. `product-sdk:product-sdk-app-builder` +
`tailwind-design-system` when building a component). Make sure you have the
up-to-date versions.

### `product-sdk` plugin skills

This repo also enables the **`product-sdk`** plugin from the public
[`paritytech/product-sdk`](https://github.com/paritytech/product-sdk) marketplace,
wired up in `.claude/settings.json` so it installs automatically when you trust
this repo (no manual setup; kept current via `claude plugin update`). It provides
per-package `@parity/product-sdk` skills, invoked namespaced as `product-sdk:<name>`:

| Skill                                       | Domain                                                            |
| ------------------------------------------- | ----------------------------------------------------------------- |
| `product-sdk:product-sdk-chain-connection`  | Chain connection, state queries, subscriptions, typed APIs        |
| `product-sdk:product-sdk-transactions`      | Tx submit/watch, wallet connection, signers, key management       |
| `product-sdk:product-sdk-contracts`         | PolkaVM/Solidity contracts, `ContractManager`, codegen            |
| `product-sdk:product-sdk-cloud-storage`     | CID-based cloud storage, upload/fetch, IPFS gateway               |
| `product-sdk:product-sdk-statement-store`   | Statement Store pub/sub, channels, BYOD transport                 |
| `product-sdk:product-sdk-utilities`         | SS58/H160/EVM address, crypto, encoding, token formatting, logger |
| `product-sdk:product-sdk-app-builder`       | End-to-end scaffolding/implementation of a Polkadot app           |
| `product-sdk:migrating-to-product-sdk`      | Migrate a legacy codebase to `@parity/product-sdk`                |

## Architecture

```
Deployer EOA
  ├── deploys: festivalPoapContract (AttendancePOAP) — retains factory rights
  ├── deploys: sessionPoapContract (AttendancePOAP) — transfers factory to Festival
  └── deploys: Festival
        ├── mints via: festivalPoapContract.mintPOAP()
        ├── owns: sessionPoapContract (authorizes session minters)
        └── deploys: FestivalSession instances
```

**Three layers:**

1. **Contract layer** — a pallet-revive (EVM) parachain on Polkadot. Festival →
   Session → POAP hierarchy.
2. **Metadata layer** — Bulletin Chain (pallet-transaction-storage). JSON blobs
   addressed by CID (Blake2b-256, CIDv1). Contracts store only `bytes32` CIDs.
3. **Front-end layer** — two Nuxt 3 SPAs + the shared TypeScript library, behind
   a host-only boot gate.

## Tech Stack

- **Frontend:** Nuxt 3, Vue 3 (Composition API + `<script setup>`), TypeScript,
  Tailwind CSS v4, Pinia. Node 22.
- **Contracts:** Solidity ^0.8.20, Foundry, OpenZeppelin v5.5.0, EVM target
  `cancun`.
- **Chain client:** PAPI (`polkadot-api`) — all reads via `ReviveApi.call()`
  dry-run, writes via `Revive.call()` extrinsic.
- **ABI encoding:** viem (encode/decode only — never as transport).
- **Bulletin Chain:** direct WebSocket via `getWsProvider` (host allows WS).
- **Monorepo:** npm workspaces (`packages/*`).
- **Venue map:** MapLibre GL engine over GeoJSON floors generated from Figma SVG
  exports.

## Critical Rules

### Host-Only

- Boot gate: `detectHostEnvironment()` → if standalone, show "Open in Polkadot
  Host" and stop.
- Wallet: accounts provider from the product SDK. No browser-extension discovery.
- Main chain PAPI: host-routed WebSocket via `createPapiProvider(genesisHash)`.
- Bulletin chain PAPI: `getWsProvider(url)` (direct WebSocket — allowed by the
  host sandbox).
- No `window.injectedWeb3`, no `window.ethereum`, no direct `fetch()` to RPC
  endpoints.

### pallet-revive via PAPI

- H160 addresses: `Binary.fromHex(address.toLowerCase())` — the `.toLowerCase()`
  is critical.
- `Vec<u8>` calldata: `Binary.fromHex(calldata)`.
- Fixed-size bytes (H160, AccountId32) must be a hex string; variable-length
  (`Vec<u8>`) must be a `Uint8Array`.
- The unsafe API uses snake_case: `weight_limit`, `ref_time`, `proof_size`.
- Don't destroy the PAPI client in `finally` — observable-based
  `signSubmitAndWatch` needs the connection alive.

### CID Computation

- CIDv1, Blake2b-256 (`0xb220`), raw codec (`0x55`).
- Use `blake2b` from `@noble/hashes/blake2b` with `{ dkLen: 32 }`. The library
  has no `blake2b256` convenience export — importing one fails.
- Libraries: `multiformats`, `@noble/hashes`.

### Contract Conventions

- Custom errors only (no `require` strings).
- Token IDs start at 1 (zero = "no token" sentinel); sessions additionally use
  `type(uint256).max` as a reserved creator token id.
- All address/tokenId params in events are `indexed`.
- Roles: `DEFAULT_ADMIN_ROLE`, `MANAGER_ROLE`, `VOLUNTEER_ROLE`. `VOLUNTEER_ROLE`
  authorizes door ops (`checkIn`, `manualCheckIn`); `MANAGER_ROLE` owns
  metadata/capacity updates; `DEFAULT_ADMIN_ROLE` owns lifecycle (cancel,
  policy). On construction of both `Festival` and `FestivalSession`, the creator
  is granted all three roles; further delegation is via `grantRole`.
- `register()` is free (non-payable). `checkIn()` mints a POAP atomically.
  `manualCheckIn()` registers + checks in + mints in one call.
- `Festival` constructor takes 4 params (`creator`, `festivalPoapContract`,
  `sessionPoapContract`, `sessionsEnabled`). Configuration is one-shot via
  `setup(metadataCid, channelMetadataCid, startTime, endTime, capacity)`.
- Session creation (`createSession`) is **POAP-gated**: the caller must own a
  festival POAP minted by this Festival. Session time window must fall fully
  within the festival `[startTime, endTime]`, capped at 2 sessions per creator
  per festival day.
- Session bootstrap is driven by the parent Festival: deploy `FestivalSession`
  → `authorizeMinter` on the session POAP → `session.initCreator()`
  (auto-checks-in the creator).
- Session cancellation goes through `Festival.cancelSession(addr)` with
  dual-path auth: below the flag threshold, the session admin (creator) may
  cancel; at/above the threshold, only the festival admin/manager may, and the
  creator is blocked.

### Metadata

- Festival metadata: name, description, location, image CID, schedule array,
  venue map (image/GeoJSON + markers), tags, social, organizer.
- A second `channelMetadataCid` holds the festival's announcement channel — an
  append-only list of announcement CIDs (one-way admin → attendee broadcast, not
  chat).
- Session metadata: name, description, location (venue marker), speakers,
  category, badge (16×16 pixel art).
- Venue map markers have stable IDs referenced by schedule entries and sessions.
- Floor plan images: compress client-side before Bulletin Chain upload.

## Networks

There is no single hardcoded chain. The network registry at
`packages/shared/host/networks.ts` is the source of truth for which chains a
build can connect to (each entry: main + Bulletin chain WSS + genesis, IPFS
gateway, native token). `VITE_NETWORK` selects one at build time and pulls in
the matching PAPI descriptors via the `#active-descriptors` alias.

The default dev target is **Paseo Asset Hub** (Polkadot Hub TestNet, chain id
`420420417`, native token PAS / 10 decimals). See the repo root README for the
process of registering a new network.

## Project Structure

```
conference-app/
├── packages/
│   ├── shared/          # Pure TS library (host, contracts, metadata, venue, cache, checkin)
│   ├── admin/           # Admin Nuxt SPA (desktop-friendly)
│   └── attendee/        # Attendee Nuxt SPA (mobile-first)
├── contracts/
│   ├── src/
│   │   ├── protocols/   # NonTransferableERC721, AttendancePOAP, Multicall3
│   │   └── apps/events/ # Festival, FestivalSession
│   ├── test/            # Foundry tests
│   ├── e2e/             # Hardhat + resolc tests on a real revive node
│   └── script/
├── scripts/             # setup.ts (guided deploy) + deploy/ chain/ e2e/ maps/ lib/
├── docs/                # Architecture notes + a reference library (see docs/README.md)
└── .claude/skills/      # Skills (loaded per domain)
```

## Environment Variables

| Variable                                                 | SPA  | Description                                                                                                           |
| -------------------------------------------------------- | ---- | --------------------------------------------------------------------------------------------------------------------- |
| `VITE_NETWORK`                                           | Both | Network key from the registry (`paseo`, `paseo-next-v2`, …)                                                           |
| `VITE_FESTIVAL_ADDRESS`                                  | Both | Festival contract address (baked at build)                                                                            |
| `VITE_FESTIVAL_POAP_ADDRESS`                             | Both | Festival-level AttendancePOAP address                                                                                 |
| `VITE_SUB_EVENT_POAP_ADDRESS`                            | Both | Session-level AttendancePOAP address. Env key keeps the legacy `SUB_EVENT` name; on-chain it's `sessionPoapContract`. |
| `VITE_BULLETIN_SIGNER_SEED`                              | Both | Mnemonic for the Bulletin Chain app account for dev local mode                                                        |
| `VITE_DOTNS_ID`                                          | Both | DotNS domain id used for host/registration wiring                                                                     |
| `VITE_MULTICALL_ADDRESS`                                 | Both | Multicall3 address for batched reads                                                                                  |
| `VITE_CHAIN_GENESIS_HASH` / `VITE_BULLETIN_GENESIS_HASH` | Both | Genesis overrides (only for chains without a built-in genesis)                                                        |
| `VITE_BUILD_HASH` / `VITE_BUILD_DATE`                    | Both | Injected at build time for footer/debug display                                                                       |
| `VITE_DEV_SEED`                                          | Both | For dev local mode                                                                                                    |

Copy `.env.example` (or a `.env.<network>.example`) in each SPA to `.env`.

## Build & Dev Commands

```bash
# Install everything (regenerates PAPI config + descriptors via postinstall)
npm install

# Contracts
cd contracts
make install          # forge-std + OZ
make build            # compile
make test             # forge tests
make copy-abis        # copy ABIs into packages/shared/

# Frontend (from root)
npm run dev:admin                 # admin dev server
npm run dev:attendee              # attendee dev server
npm run dev:attendee:paseo-next-v2  # dev against a specific network's .env

# Tests
npm run test:unit                 # node --test (packages/** + scripts/**)
npm run test:e2e                  # Playwright (admin + attendee)

# Maps + descriptors
npm run build:maps                # Figma SVG exports → GeoJSON
npm run papi:update               # regenerate PAPI descriptors from the registry
```

## Testing & UI Changes

- e2e tests live under `packages/admin/e2e/` and `packages/attendee/e2e/`
  (Playwright, with the host simulated via the host-api test SDK).
- When a UI change adds/renames/removes elements or flows, update the
  corresponding spec in the same change — selectors, `data-testid` hooks,
  assertions, and new-flow coverage. A UI change with stale tests is incomplete.
- If the environment can't run Playwright (e.g. missing host context), say so
  explicitly rather than claiming the tests pass.
