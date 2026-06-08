# @festival/shared

The pure-TypeScript library that sits between the two Nuxt SPAs and everything
external — the EVM contracts, the Bulletin Chain, and the Polkadot Host. No Vue
SFCs live here; it ships composables, stores, helpers, and the headless venue
map engine. Both `admin` and `attendee` import from it as `@festival/shared/*`.

`index.ts` is the barrel export; `package.json` declares the `#active-descriptors`
import alias that resolves to the PAPI descriptors for the network selected by
`VITE_NETWORK`.

## Module map

```
shared/
├── host/         # Host detection, PAPI clients, network registry, wallet, permissions
├── contracts/    # ABIs, addresses, typed reads/writes, Multicall3, Tick3t integration
├── metadata/     # Bulletin Chain read/write, CID computation, Zod schemas, image compression
├── cache/        # Reactive festival state, event watcher, IndexedDB + CID caches
├── venue/        # Headless MapLibre engine + GeoJSON floors, categories, zones, icons
├── checkin/      # Check-in challenge signing, QR encode/decode, verification
├── scanner/      # Camera QR scanning + QR image generation composables
├── sessions/     # Session time-window validation (legal start/end slots)
├── identity/     # Address → display-name resolution
├── utils/        # Address, time, balance, badge (pixel-art), festival-colour helpers
├── metadata-types & types/  # Shared TS types + Vite ?raw import declarations
├── mocks/        # Dev fixtures (only used outside production paths)
├── assets/ public/ icons/   # Floor-plan sources, generated GeoJSON, fonts, marker icons
├── permissions.ts           # usePermissions() — role → capability mapping
└── index.ts                 # Barrel export
```

### `host/` — boot & chain layer

The single place that knows whether the app is running inside the Polkadot Host
and how to reach a chain.

- `detect.ts` — `detectHostEnvironment()` → `desktop-webview` | `web-iframe` |
  `standalone`, plus iOS platform detection.
- `boot.ts` — host startup: injects the host wallet bridge and brings up PAPI
  clients.
- `client.ts` — PAPI client factory, cached per genesis hash (host mode uses the
  host-routed provider; standalone uses a direct WebSocket).
- `networks.ts` — **the network registry** (`paseo`, `paseo-next-v2`,
  `previewnet`): main + bulletin chain endpoints, genesis hashes, IPFS gateway,
  native token. The source of truth for which chains a build can connect to.
- `descriptors/` — generated PAPI type descriptors per network; `active.ts`
  re-exports the pair chosen by `VITE_NETWORK`.
- `wallet.ts` — Pinia store for accounts, selected account, and host/standalone
  signing mode.
- `permissions.ts`, `notifications.ts`, `navigation.ts`, `theme.ts` — host API
  surfaces (camera/remote-access permission requests, host notifications,
  navigation callbacks, theme sync).

### `contracts/` — EVM bindings

- `abis/` — Foundry-generated ABIs (`Festival`, `FestivalSession`,
  `AttendancePOAP`, `NonTransferableERC721`, `Multicall3`) + a typed barrel.
  Refreshed from the contracts package via `make copy-abis`.
- `addresses.ts` — deployed addresses, overridable by the `VITE_*_ADDRESS` env
  vars.
- `read.ts`, `festival-reads.ts`, `multicall.ts` — low-level reads, high-level
  festival/session/attendee/POAP reads, and Multicall3 batching (cold boot
  collapses many reads into a few RPC rounds).
- `write.ts`, `write-batch.ts`, `session-writes.ts` — single + batched contract
  writes with a signing → in-block → finalized status watcher.
- `role-helpers.ts`, `errors.ts`, `types.ts` — role bitset decoding, revert
  decoding, and the shared contract TS types.
- `tick3t-*.ts` — read/verify/QR helpers for the external Tick3t ticket source
  used at check-in.

### `metadata/` — Bulletin Chain + CIDs

- `bulletin.ts` — authorize, upload (text / image / schedule), and fetch blobs
  from the Bulletin Chain (with IPFS-gateway and preimage fallbacks).
- `cid.ts` — CIDv1 / Blake2b-256 computation and `bytes32 ↔ CID` conversion
  (the indirection that keeps signing payloads small).
- `schemas.ts`, `validation.ts` — Zod schemas for festival, session, venue-map,
  and schedule metadata, plus validation.
- `channel.ts`, `announcementBodies.ts` — the announcement-channel blob schema
  and body fetching.
- `image.ts` — client-side image compression before upload.

### `cache/` — reactive state & watcher

- `festival-state.ts` — the central reactive festival state (details, attendees,
  POAPs, roles) consumed by both SPAs.
- `event-watcher.ts` + `useFestivalWatcher.ts` — subscribe to contract events
  and reconcile them into state.
- `cid-cache.ts`, `storage.ts`, `visibility.ts` — in-memory CID cache, IndexedDB
  persistence for cache-first paint, and tab-visibility gating for background
  work.

### `venue/` — map engine

Headless MapLibre GL engine plus its data. See [`venue/README.md`](./venue/README.md)
for the Figma-SVG → GeoJSON conversion pipeline.

- `map-engine-ml.ts` — `createVenueMap()` returning a `VenueMapHandle`
  (`focusMarker`, `fitToFloor`, `getZoneAt`, floor switching, user-spot pin,
  out-of-bounds blocking). The SPAs wrap this in their own `VenueMap.vue`.
- `categories.ts` — marker category specs (colour, label, reveal tier).
- `zones.ts`, `floors.ts`, `icons.ts`, `map.css` — zone definitions, floor/block
  metadata, marker icon registry, and zoom-tier styling.

### Smaller modules

- `checkin/` — `sign.ts` / `verify.ts` / `qr.ts`: signed check-in challenges
  (timestamped, short-lived) and their QR encoding.
- `scanner/` — `useQRScanner` (camera) and `useQRImage` (generation).
- `sessions/timeWindow.ts` — legal session start/end slots (aligned, bounded by
  the festival window; illegal times are omitted, never shown disabled).
- `identity/resolve.ts` — on-chain identity / account-name resolution.
- `utils/` — address formatting, time/timezone helpers, balance formatting,
  pixel-art badge encode/decode, and festival brand-colour derivation.

## Tests

`test/` holds unit tests (e.g. CID conversion, festival colour). They run under
the repo's unit runner (`node --test` via tsx) alongside the rest:

```bash
npm run test:unit        # from repo root — packages/**/*.test.ts + scripts/**/*.test.ts
```

## PAPI descriptors

Typed chain reads need generated descriptors. After changing a network or its
metadata, regenerate from the registry:

```bash
npm run papi:update      # from repo root
```

The `postinstall` hook regenerates the PAPI config + client descriptors so a
fresh `npm install` is enough for connection; only typed reads need the full
`papi:update`.
