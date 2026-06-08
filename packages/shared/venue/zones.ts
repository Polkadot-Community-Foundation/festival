import type { VenueZone } from '../metadata/schemas'

/**
 * Default zones for the current festival. Source of truth at runtime is
 * `venueMap.zones[]` in the festival metadata; this array seeds mocks and
 * provides labels for the colored regions baked into the floor plan SVGs.
 *
 * The `id` of each zone MUST match the `id` attribute on a `<path>` inside
 * the floor SVG so the map can look it up via `svgOverlay.querySelector('#<id>')`
 * for highlighting.
 */
export const DEFAULT_ZONES: VenueZone[] = [
  // Block B · 1st Floor
  { id: 'studio-1-b-1', floorId: 'block-b-first-floor', label: 'Studio 1' },
  { id: 'foyer-b-1', floorId: 'block-b-first-floor', label: 'Foyer' },
  { id: 'studio-2-b-1', floorId: 'block-b-first-floor', label: 'Studio 2' },

  // Block B · Ground
  { id: 'courtyard-b-gr', floorId: 'block-b-first-ground', label: 'Courtyard' },
  { id: 'pba-h14-b-gr', floorId: 'block-b-first-ground', label: 'PBA H14' },
  { id: 'pba-h15-b-gr', floorId: 'block-b-first-ground', label: 'PBA H15' },
  { id: 'h2-room-b-gr', floorId: 'block-b-first-ground', label: 'H2' },
  { id: 'studio-4-b-gr', floorId: 'block-b-first-ground', label: 'Studio 4' },
  { id: 'bar-b-gr', floorId: 'block-b-first-ground', label: 'Bar' },
  { id: 'foyer-b-gr', floorId: 'block-b-first-ground', label: 'Foyer' },
  { id: 'check-in-b-gr', floorId: 'block-b-first-ground', label: 'Check-in' },
]

export function getZone(zoneId: string, zones: VenueZone[]): VenueZone | undefined {
  return zones.find(z => z.id === zoneId)
}

export function zonesForFloor(floorId: string, zones: VenueZone[]): VenueZone[] {
  return zones.filter(z => z.floorId === floorId)
}

/** "Studio 1" → breadcrumb suffix for a card header. */
export function getZoneLabel(zoneId: string | undefined, zones: VenueZone[]): string | undefined {
  if (!zoneId) return undefined
  return zones.find(z => z.id === zoneId)?.label
}
