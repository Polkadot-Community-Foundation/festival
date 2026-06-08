# Venue map

Source-of-truth SVG floor plans live in `packages/shared/public/floorplans/source/`. They are exported from Figma with a tag convention that drives the converter at `scripts/convert-maps.py`. The converter emits GeoJSON the MapLibre engine reads at runtime, plus a label-stripped overlay SVG for the outdoor view.

## Regenerating GeoJSON after a Figma export

```bash
pip install svgpathtools shapely     # one-time
npm run build:maps
```

Inputs: every `source/*.svg`. Outputs (committed): `venue.geojson`, `block-b-first-ground.geojson`, `block-b-first-floor.geojson`, `venue-overlay.svg`.

## Figma layer tag convention

Layer names: `<Display Name> #tag1 #tag2` — space-separated, lowercase, hash-prefixed. Tags propagate down through groups, so naming the wrapping group `Walls #structure` is enough — leaf paths inherit.

### Structural tags (drive rendering)

| Tag | Meaning |
|---|---|
| `#zone` | Clickable named area. Renders as a colored fill polygon. Pair with a display name. |
| `#structure` | Walls, water, building base, landscape — non-navigable environment. |
| `#scenery` | Bushes, trees, decorative landscape. Subtle background. |
| `#decoration` | Subtle interior details inside zones (stage outlines, seating tiers). |
| `#mask` | Invisible polygon clipping zone fills to the walkable interior. Must have a fill color in Figma so it survives export. |
| `#main-building` | The enter-able building on the site map. One per outdoor SVG. |

### Behavioural tags (drive app logic)

| Tag | Meaning |
|---|---|
| `#forbidden` | Pin drops blocked here (backstage, water, restricted). |
| `#no-name` | Zone intentionally has no display name. |

### Categorical tags (advisory, free-form)

`#studio`, `#parking`, `#camping`, `#food`, `#stage`, `#amenity`, `#public`, `#outside`. Engine ignores specifics; app code can filter on them.

## Spot markers (zone labels)

Inside the SVG, a "Spot marker" group whose name matches a zone (e.g. `STUDIO 1`) containing a centered `<text>STUDIO 1</text>`. The converter:

1. Extracts the text content as a label feature
2. Auto-overrides the position using **polylabel** (pole of inaccessibility) on the matching zone's polygon — finds the point farthest from any edge. Robust for concave shapes.
3. Falls back to the spot marker's literal position only when no zone matches (typo, missing zone).

Match is case-insensitive and alphanumeric-only, so `Studio 1` matches `STUDIO 1`.

## Output GeoJSON shape

Each feature has properties:

```json
{
  "name": "Studio 1",
  "tags": ["zone", "forbidden", "studio"],
  "id": "studio-1",
  "fill": "#7B61FF",
  "stroke": "#000000",
  "strokeWidth": 8,
  "fillOpacity": 0.3,
  "strokeOpacity": 0.5,
  "blur": 60,
  "blend": "plus-lighter"
}
```

`id` is a slug derived from `name`. The MapLibre engine references features by `id` for zone highlighting and admin auto-zone detection. Missing optional fields mean they weren't set on the source.

## Filename → floor id mapping

| Source SVG | Output GeoJSON | floor id |
|---|---|---|
| `site.svg` | `venue.geojson` | `venue` |
| `block-b-ground.svg` | `block-b-first-ground.geojson` | `block-b-first-ground` |
| `block-b-first-floor.svg` | `block-b-first-floor.geojson` | `block-b-first-floor` |

`site.svg` additionally emits `venue-overlay.svg` — a label-stripped copy of the source with the expensive `Vector 134` blur removed, used by the engine's outdoor SVG overlay layer for Figma effects MapLibre's style spec can't express (Gaussian blur on strokes, `mix-blend-mode: plus-lighter`).

## Common gotchas

1. **Y-flip is baked at convert time.** SVG `(x, y)` becomes GeoJSON `(x, vbH - y)`. Don't re-flip in the browser.
2. **Figma auto-names are filtered.** `Vector 96`, `Path 4`, `Rectangle 12`, `Group 28989703` etc. — converter discards them so they don't override meaningful inherited names.
3. **Mask buffer (1 px inward).** Zone fills are clipped to the mask shrunk inward by 1 px to avoid hairline overlap with walls at deep zoom. Adjust `MASK_BUFFER_INWARD` in the script if gaps appear.
4. **Spot marker name must match zone name.** Typo → label falls back to its literal position. Check the converter's `auto-positioned N label(s)` line: if N is lower than expected zone count, hunt for typos.
5. **`#mask` must have a fill in Figma.** Otherwise SVG export strips it. The converter strips the fill again — only the geometry survives.

## Runtime engine

The generated GeoJSON is consumed by the headless MapLibre engine
`map-engine-ml.ts` (`createVenueMap()` → `VenueMapHandle`), which both SPAs wrap
in their own `VenueMap.vue`. Marker appearance and the zoom-tier reveal rules
live in `categories.ts` (per-category colour, label, `revealTier`) and
`map.css`; floor/block metadata in `floors.ts`; the marker icon registry in
`icons.ts`. `HANDOFF.md` has the map design notes.
