# Packages

The front-end half of the Festival prototype is an npm-workspaces monorepo of
three packages: one shared TypeScript library and two Nuxt SPAs that consume it.

```
packages/
├── shared/     # Pure TypeScript library — host boot, chain reads/writes, metadata, venue engine
├── admin/      # Admin SPA (desktop-friendly) — check-in, schedule, map, roles, announcements
└── attendee/   # Attendee SPA (mobile-first) — registration, schedule, map, sessions, badges
```

## How they fit together

```
        ┌─────────────┐     ┌──────────────┐
        │  admin SPA  │     │ attendee SPA │      Nuxt 3 / Vue 3 / Tailwind v4
        └──────┬──────┘     └──────┬───────┘
               │                   │
               └─────────┬─────────┘
                         ▼
                ┌──────────────────┐
                │ @festival/shared │              pure TS — no Vue SFCs
                └────────┬─────────┘
                         │
        ┌────────────────┼────────────────┐
        ▼                ▼                 ▼
  pallet-revive      Bulletin Chain     Polkadot Host
  (EVM contracts)    (metadata, CIDs)   (wallet, signing, PAPI)
```

- **`shared`** is the only package that talks to the chain, the host, or the
  Bulletin Chain. It exports typed contract reads/writes, metadata
  upload/fetch + CID helpers, host detection / PAPI client wiring, the wallet
  store, the MapLibre venue engine, and role/permission helpers. The SPAs
  import from it as `@festival/shared/*`.
- **`admin`** and **`attendee`** are thin presentation layers: file-based Nuxt
  routes, Vue components, and composables that orchestrate calls into
  `shared`. They never reach the chain directly.

## Shared conventions

- **Host-only boot.** Both SPAs gate on `detectHostEnvironment()`; a standalone
  browser falls through to an "Open in Polkadot Host" screen.
- **One festival per SPA build.** `VITE_FESTIVAL_ADDRESS` (plus the POAP /
  multicall addresses) is baked at build time. The admin is pinned to one
  festival it manages; the attendee app to the one it displays.
- **Metadata off-chain.** Contracts store only `bytes32` CIDs; all human-facing
  content lives on the Bulletin Chain. The signing payload therefore stays
  under the host signer's ~500-byte limit.
- **Multi-network.** The chains each build can target live in the registry at
  `shared/host/networks.ts`; `VITE_NETWORK` selects one and pulls in the
  matching PAPI descriptors via the `#active-descriptors` alias.

## Working in the monorepo

```bash
# from repo root
npm install                              # installs all workspaces

npm run dev:admin           # admin dev server
npm run dev:attendee         # attendee dev server

npm run -w packages/admin build          # static SPA build
npm run -w packages/attendee build       # static SPA build
```

If running with `npm run dev:admin` then the system will use `.env` file in each package. There's also the posibility of running `npm run dev:admin:<network>` which will utilize the `.env.<network>` configuration file, together with the network configuration set in `/host/networks`

Each package carries its own README with the detail for that layer.
