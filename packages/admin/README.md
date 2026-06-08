# Admin SPA

The admin app prototype for running festival's check-in, schedule, map, role
management, and announcements. It is a Nuxt 3 / Vue 3 (Composition API) SPA that
runs inside the Polkadot Host and talks to the Festival contract on the
configured Polkadot network (the registry lives in
`packages/shared/host/networks.ts`).

A single `VITE_FESTIVAL_ADDRESS` is baked at build time. The root route is a
gate: if a festival address is configured it redirects to
`/festival/[address]/…`; otherwise it sends an admin to `/create` to deploy and
configure one. Every operational page lives under `/festival/[address]/…` and is
gated by the connected account's on-chain role on that exact contract.

### Pages at a glance

| Route                               | Min role  | Purpose                                                 |
| ----------------------------------- | --------- | ------------------------------------------------------- |
| `/` , `/create`                     | —         | Entry gate + festival deploy/configure wizard           |
| `/festival/[address]` (index)       | Volunteer | Festival overview + session toggle                      |
| `/festival/[address]/checkin`       | Volunteer | Two-scan ticket + account check-in                      |
| `/festival/[address]/attendees`     | Volunteer | On-chain attendee roster + check-in status              |
| `/festival/[address]/schedule`      | Manager   | Edit the program (draft until Publish)                  |
| `/festival/[address]/map`           | Manager   | Place/edit venue markers + zones (draft until Publish)  |
| `/festival/[address]/announcements` | Manager   | Publish broadcast announcements to the channel          |
| `/festival/[address]/sub-events`    | Volunteer | Browse attendee-created sessions; moderate flagged ones |
| `/festival/[address]/changes`       | Manager   | Review queued draft changes before publishing           |
| `/festival/[address]/settings`      | Admin     | Roles, session policy, capacity, cancel                 |

---

## Architecture in one paragraph

The admin prototype SPA never mutates contract storage directly with strings. Everything
the audience sees (Summit name, schedule, venue map, marker positions)
lives on the Polkadot Bulletin Chain as a single JSON blob. The
on-chain `Festival` contract stores only a `bytes32 metadataCid` pointing at
that blob. Edits in the admin are made against a **local draft**; clicking
**Publish** uploads the new draft to Bulletin Chain, gets back a CID, and
fires one `Festival.updateCid(bytes32)` transaction. Check-in is the only
admin flow that writes to contract state per-attendee; every other day-of
operation is metadata-only.

---

## Roles

Three roles on the `Festival` contract, hierarchical (each tier inherits the
one below):

| Role          | Inherits            | Day-of capabilities                                    |
| ------------- | ------------------- | ------------------------------------------------------ |
| **ADMIN**     | Manager + Volunteer | Manage roles, cancel festival, toggle session policy   |
| **MANAGER**   | Volunteer           | Edit schedule, map, capacity; publish metadata         |
| **VOLUNTEER** | —                   | Run check-in (scan attendee accounts, mark as arrived) |

The sidebar nav and every action button are filtered by `usePermissions()`
against the live `userRoles` of the connected account. A volunteer signing in
on the gate iPad sees `Check-In` only; an admin sees the full menu.

---

## Check-In (`/festival/[address]/checkin`)

The check-in page is the only one a Volunteer can reach. A volunteer scans the
attendee's account QR (or types/scans their address in the manual fallback) and
checks them in on the Festivals's `Festival` contract, which registers the
attendee if needed, marks attendance, and mints the Festival POAP atomically.

### Scan flow

1. **Scan account QR.** The attendee shows their wallet's SS58 address QR. The
   app reads `Festival.isRegistered(addr)` and `Festival.isCheckedIn(addr)` so
   the volunteer sees `New attendee` vs `Registered, not yet checked in`, and
   refuses to re-check-in someone already marked.
2. **Confirm.** A single transaction calls `Festival.checkIn(addr)` (already
   registered) or `Festival.manualCheckIn(addr)` (new attendee) — registering
   if needed, marking attendance, and minting the Festival POAP.

### Manual entry

A collapsible "Manual Entry" section accepts an SS58 or 0x address typed in or
scanned from a QR. It calls `Festival.checkIn` / `Festival.manualCheckIn`
directly. Used for VIPs, fallback when the camera fails, or when a volunteer is
checking someone in remotely from the office.

### Role gate

Check-in UI visibility is gated by the connected account's `VOLUNTEER_ROLE` on
the Summit `Festival` contract, resolved at boot. Only volunteers, managers, and
admins reach the Check-In page; the contract's own role checks gate the write.

### Recent check-ins

The last few check-ins from this device's session render below the form with a
QR/Manual badge and a relative timestamp. This is session-local memory (not a
global log) so a fresh page load starts empty. Use the Attendees page for the
canonical, on-chain check-in roster.

---

## Schedule (`/festival/[address]/schedule`)

Managers edit the Festival's program here. Entries are local-only until
**Publish** is hit; the panel in the sidebar shows how many sections have
unsaved changes.

### Adding an entry

Click **Add Entry**. The `ScheduleEntryForm` asks for:

- **Title** — e.g. `Opening Keynote: The State of Polkadot`
- **Description** — free text, surfaces on the attendee SPA's session detail
- **Start / End** — `datetime-local` inputs, **bounded by the Summit's
  on-chain `startTime` / `endTime`**. The picker physically refuses to let
  you set an entry outside the contract's stated dates — entries outside the
  window would be invisible to the attendee SPA's "happening now" logic
  anyway.
- **Speakers** — comma-separated names. Stored as `string[]` in metadata.
- **Venue marker** _(optional)_ — drop-down of the venue map markers
  currently in the draft. Picking one links the entry to that physical
  location. The attendee map shows a "Now / In X min" strip when an attendee
  taps a marker that has an entry scheduled there.

### Ordering

The entry list sorts by start time. Manual ▲ / ▼ arrows on each row let
managers tweak presentation order within a tied start-time window, useful
when two workshops nominally start at 14:00 but one should be listed first.

### Status badges

Rows light up green ("New") or amber ("Edited") until the next publish, so
managers can see exactly what's queued without diffing JSON.

### Publishing

Publish lives in the festival layout sidebar, not on the schedule page —
schedule, map, and overview metadata edits all batch into one CID write.
See **Publishing changes** below.

---

## Maps (`/festival/[address]/map`)

The venue map is a multi-floor MapLibre GL view. The map page lets Managers
place, edit, and remove markers, plus author the link between a marker and a
zone. The rendering engine is shared with the attendee SPA and lives in
`packages/shared/venue/map-engine-ml.ts`; both SPAs wrap it in a local
`VenueMap.vue` component.

### Floors & GeoJSON

Floor surfaces are **GeoJSON** files generated from Figma SVG exports — not
inlined SVG. The converter (`scripts/maps/convert-maps.py`, `npm run
build:maps`) emits one GeoJSON per floor plus a label-stripped overlay SVG for
the outdoor view; see `packages/shared/venue/README.md` for the tag convention
and output schema. The engine loads these as MapLibre sources:

- **Venue (outdoor)** — the overhead site plan. Click the enter-able building
  outline (tagged `#main-building`) to step inside; click elsewhere to drop an
  outdoor marker.
- **Block B — Ground / 1st Floor** — the indoor floorplans. A `FloorControl`
  in the canvas toggles between them.

Each GeoJSON `#zone` feature carries an `id` slug derived from its name. That
`id` is what the engine highlights behind a selected marker and what zone
auto-detection returns.

### Adding a marker

In Manager+ mode, clicking anywhere on the active floor opens the `MarkerForm`
with that point pre-filled. The form asks for:

- **Category** — `base` (rooms, stages, stairs, elevators, doors, etc.),
  `food`, `activations`, `service` (restrooms, wifi, info…), `emergency`,
  `money`, or `scenery` (benches, trees — pure ornaments, no label). Category
  specs (colour, label, reveal tier) live in
  `packages/shared/venue/categories.ts`.
- **Type** — filtered to the chosen category. Drives the icon glyph.
- **Label** — required for categories that show text labels (`base`, `food`,
  `activations`); optional for the icon-only categories.
- **Zone** — auto-detected. When you click a point inside a zone polygon, the
  engine runs `getZoneAt(x, y)` (point-in-polygon against the floor's zone
  features) and prefills the dropdown.

Save adds the marker to `draft.venueMap.markers`. The marker list below the
map shows every marker on every floor with a colour-coded icon tile, the floor
it lives on, and its coordinates. New markers are tagged green, edited markers
amber, until the next publish.

### Out-of-bounds

Zones tagged `#forbidden` in the GeoJSON (water, backstage, restricted areas)
block pin drops. The admin map does **not** enforce this (you may legitimately
need to place a marker on a service road), but the attendee SPA does — same
engine, with the `blockOutOfBounds: true` option set.

### Initial fit & zoom

The map auto-fits to the active floor on mount and on every container resize
(`fitToFloor()`). Pinch-out is clamped to the fit zoom and panning is clamped
to the floor bounds — the canvas always frames the floorplan, never empty void.

### Zoom tiers & progressive reveal

The engine derives a **zoom tier** (0–4) from the current zoom and writes it to
the map container as `data-zoom-tier`. Each category declares the lowest tier at
which it becomes visible (`revealTier` in `categories.ts`), so the overview
stays readable at default zoom and finer-grained markers appear as the user
zooms in:

| Reveal tier | Categories that appear                     |
| ----------- | ------------------------------------------ |
| 0           | **Scenery** (benches, trees — always on)   |
| 1           | + **Food**                                 |
| 2           | + **Activations**                          |
| 3           | + **Base** (rooms, stages, doors, stairs…) |
| 4           | + **Service**, **Emergency**, **Money**    |

Scenery is intentionally always-on — it's ornamentation, not a destination, and
gives a sense of place on the overview. Service / emergency / money markers are
deliberately held back to tier 4 so the close-in view feels exhaustive without
cluttering the overview. While the **MarkerForm is open**, the in-progress
marker is forced visible regardless of tier, then rejoins the normal reveal
rules on Save.

The per-tier sizing / visibility rules live in
`packages/shared/venue/map.css`.

---

## Attendees (`/festival/[address]/attendees`)

The canonical, on-chain roster. Reads `Festival.getAttendees()` (addresses +
check-in flags) via Multicall3 and renders registered vs checked-in counts.
Unlike the check-in page's session-local "recent" list, this is the source of
truth for who is registered and who has actually arrived. Identities are
resolved to display names where available.

## Announcements (`/festival/[address]/announcements`)

Managers broadcast to attendees here. Each announcement body is uploaded to the
Bulletin Chain; its CID is appended to the festival's announcement-channel blob,
which is itself re-uploaded and pinned by a single
`Festival.updateChannelMetadataCid(bytes32)` write. The attendee SPA watches the
`ChannelMetadataUpdated` event and refreshes its notifications view. This is a
one-way admin → attendee channel — there is no peer-to-peer chat.

## Sub-events (`/festival/[address]/sub-events`)

Attendees create their own sessions (unconference style) from the attendee SPA;
this is the admin-side window onto them. The index lists every deployed
`FestivalSession`, surfaces a **flag badge** on sessions that attendees have
reported, and the detail page (`/sub-events/[subAddress]`) shows the session's
attendees and its moderation state. Once a session's `flagCount` crosses the
contract's `FLAG_THRESHOLD`, an admin or manager can moderation-cancel it via
`Festival.cancelSession(addr)` — the session creator is blocked from
self-cancelling on that path. `sub-events/create` exists for staff-seeded
sessions.

## Settings (`/festival/[address]/settings`)

Admin-only. Four sections.

### Role Management

The roster of every address that currently holds Admin / Manager /
Volunteer on this Summit contract. Addresses are deduped, so if someone
holds Admin + Manager + Volunteer they show once with their highest tier.

- **Change tier** — select a different role on a row to switch a person's
  effective tier (granted as a single new role; existing higher roles are
  what give them their tier).
- **Remove holder** — strips every role they currently hold in a single
  pass (one `revokeRole` per role they had).
- **Grant new role** — bottom form: paste an address (SS58 or 0x), or scan
  a QR, pick a role, hit Grant. Single transaction.

### Session Settings

Read-only display of whether attendee-created sessions are enabled, and
the creation policy. Creation access is "POAP holders":
anyone holding the Festival POAP can spin up a session (un-conference
style). Toggling sessions enabled/disabled is admin-only and lives on the
festival overview page.

### Capacity

Update `Festival.capacity`. Setting it to 0 means unlimited. The contract
rejects any value below the current registered count, so you can raise the
cap mid-event but can't squeeze people out by lowering it below the
already-on-the-list number.

### Danger Zone — Cancel Summit

Calls `Festival.cancel()`. Irreversible. Blocks future registration,
check-in, and session creation but leaves the existing on-chain history
(who attended, who held POAPs) intact. A two-step confirmation dialog
prevents accidental clicks.

---

## Publishing changes

The festival layout shell carries a sidebar that aggregates unsaved
draft changes across Overview, Schedule, and Map. Every edit on those
pages mutates a local `reactive` draft, so nothing reaches the chain until
Publish is hit.

Publish does three things, in order:

1. **Upload the full metadata JSON to Bulletin Chain.** The blob includes
   festival name, dates, schedule, venue map, organiser info — the whole
   thing. Bulletin Chain returns a content-addressed CID (Blake2b-256,
   raw codec, CIDv1).
2. **Pre-cache the new CID locally** so subsequent reads from the
   attendee SPA hit the cache instead of round-tripping IPFS.
3. **Call `Festival.updateCid(bytes32)`** with the 32-byte digest of the
   CID. This is the only on-chain write. Manager+ only.

Because the contract stores only a 32-byte digest, the signing payload
stays under the host signer's ~500-byte limit — even when the JSON blob
itself is many KB.

---

## Dev / build

```bash
# from repo root
npm install
npm run dev:admin                 # nuxt dev
npm run dev:admin:paseo-next-v2   # dev against a specific network's .env
npm run build:admin               # static SPA (nuxt generate) → packages/admin/

# e2e tests
npm run test:e2e:admin
```

Required env (`.env` at the admin package root, or via the host
environment):

| Variable                      | Purpose                                                              |
| ----------------------------- | -------------------------------------------------------------------- |
| `VITE_FESTIVAL_ADDRESS`       | Summit `Festival` contract address                                   |
| `VITE_FESTIVAL_POAP_ADDRESS`  | Summit attendance POAP                                               |
| `VITE_SUB_EVENT_POAP_ADDRESS` | Session-level POAP (legacy env name, see CLAUDE.md)                  |
| `VITE_MULTICALL_ADDRESS`      | Multicall3 for batched reads                                         |
| `VITE_DOTNS_ID`               | DotNS domain id (host/registration wiring)                           |
| `VITE_DEV_SEED`               | [Local development only] User seed for development purposes          |
| `VITE_BULLETIN_SIGNER_SEED`   | [Local development only] Mnemonic for the Bulletin Chain app account |

The app expects to run inside the Polkadot Host (Desktop / Web / Mobile).
A standalone-browser boot will fall through to a "Open in Polkadot Host"
screen.
