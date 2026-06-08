import type { FestivalMetadata, ScheduleEntry, VenueMapData, VenueMarker } from '../metadata/schemas'
import { VENUE_BLOCKS } from '../venue/floors'
import { DEFAULT_ZONES } from '../venue/zones'

const MOCK_MARKERS: VenueMarker[] = [
  // ── Block B · 1st Floor ──
  { id: 'studio-1', label: 'Studio 1', x: 290, y: 240, floorId: 'block-b-first-floor', category: 'base', type: 'stage', zoneId: 'studio-1-b-1' },
  { id: 'studio-2', label: 'Studio 2', x: 85, y: 850, floorId: 'block-b-first-floor', category: 'base', type: 'stage', zoneId: 'studio-2-b-1' },
  { id: 'room-1-b1', label: 'Room 1', x: 1130, y: 465, floorId: 'block-b-first-floor', category: 'base', type: 'room' },
  { id: 'room-2-b1', label: 'Room 2', x: 1130, y: 555, floorId: 'block-b-first-floor', category: 'base', type: 'room' },
  { id: 'room-3-b1', label: 'Room 3', x: 1130, y: 645, floorId: 'block-b-first-floor', category: 'base', type: 'room' },
  { id: 'room-4-b1', label: 'Room 4', x: 1130, y: 735, floorId: 'block-b-first-floor', category: 'base', type: 'room' },
  { id: 'monom-cafe-b1', label: 'Monom Cafe', x: 205, y: 720, floorId: 'block-b-first-floor', category: 'food', type: 'food' },
  { id: 'restroom-b1', label: 'Restrooms', x: 990, y: 340, floorId: 'block-b-first-floor', category: 'service', type: 'restroom' },
  { id: 'medical-b1', label: 'Medical Aid', x: 1010, y: 390, floorId: 'block-b-first-floor', category: 'emergency', type: 'medical' },
  { id: 'water-b1', label: 'Water Spot', x: 1140, y: 810, floorId: 'block-b-first-floor', category: 'service', type: 'water' },
  { id: 'wifi-b1', label: 'WiFi Zone', x: 1240, y: 930, floorId: 'block-b-first-floor', category: 'service', type: 'wifi' },

  // ── Block B · Ground ──
  { id: 'h2-room', label: 'H2', x: 830, y: 1650, floorId: 'block-b-first-ground', category: 'base', type: 'room', zoneId: 'h2-room-b-gr' },
  { id: 'studio-4', label: 'Studio 4', x: 1100, y: 1850, floorId: 'block-b-first-ground', category: 'base', type: 'stage', zoneId: 'studio-4-b-gr' },
  { id: 'bar-gr', label: 'Bar', x: 470, y: 2000, floorId: 'block-b-first-ground', category: 'food', type: 'bar', zoneId: 'bar-b-gr' },
  { id: 'courtyard-info', label: 'Info Desk', x: 1500, y: 700, floorId: 'block-b-first-ground', category: 'service', type: 'info', zoneId: 'courtyard-b-gr' },
]

export const MOCK_VENUE_MAP: VenueMapData = {
  blocks: VENUE_BLOCKS,
  zones: DEFAULT_ZONES,
  markers: MOCK_MARKERS,
}

export const MOCK_SCHEDULE: ScheduleEntry[] = [
  {
    id: 'keynote-1',
    start: '2026-06-15T09:00:00Z',
    end: '2026-06-15T10:00:00Z',
    title: 'Opening Keynote: The Future of Web3',
    description: 'Welcome and vision for the decentralized web.',
    speakers: ['Gavin Wood'],
    venueMarkerId: 'studio-1',
  },
  {
    id: 'workshop-1',
    start: '2026-06-15T10:30:00Z',
    end: '2026-06-15T12:00:00Z',
    title: 'Building on Polkadot: Hands-On Workshop',
    description: 'Practical session covering smart contract development with pallet-revive.',
    speakers: ['Alice Developer'],
    venueMarkerId: 'h2-room',
  },
  {
    id: 'official-1',
    start: '2026-06-15T13:00:00Z',
    end: '2026-06-15T14:00:00Z',
    title: 'PAPI Deep Dive',
    description: 'Advanced patterns for Polkadot API usage in production applications.',
    speakers: ['Bob Engineer'],
    venueMarkerId: 'studio-2',
  },
  {
    id: 'social-1',
    start: '2026-06-15T18:00:00Z',
    end: '2026-06-15T21:00:00Z',
    title: 'Welcome Reception',
    description: 'Networking and refreshments.',
    speakers: [],
    venueMarkerId: 'bar-gr',
  },
]

export const MOCK_FESTIVAL_METADATA: FestivalMetadata = {
  version: '1.0',
  type: 'festival',
  name: 'Web3 Summit 2026',
  description: 'The premier decentralized web conference. Three days of talks, workshops, and networking.',
  location: {
    venue: 'Funkhaus Berlin',
    address: 'Nalepastraße 18, 12459 Berlin, Germany',
    coordinates: { lat: 52.4589, lng: 13.5013 },
  },
  image: '',
  website: 'https://web3summit.com',
  organizer: 'Web3 Foundation',
  tags: ['web3', 'polkadot', 'blockchain', 'defi'],
  social: {
    twitter: '@web3summit',
  },
  schedule: MOCK_SCHEDULE,
  venueMap: MOCK_VENUE_MAP,
}

/**
 * Schedule with entries relative to *now* so the spotlight component
 * always has "live" sessions to cycle through during dev.
 */
function offsetISO(minutesFromNow: number): string {
  return new Date(Date.now() + minutesFromNow * 60_000).toISOString()
}

export function createLiveSchedule(): ScheduleEntry[] {
  return [
    {
      id: 'live-keynote',
      start: offsetISO(-30),
      end: offsetISO(30),
      title: 'Opening Keynote: The Future of Web3',
      description: 'Welcome and vision for the decentralized web.',
      speakers: ['Gavin Wood'],
        venueMarkerId: 'studio-1',
    },
    {
      id: 'live-workshop',
      start: offsetISO(-15),
      end: offsetISO(45),
      title: 'Building on Polkadot: Hands-On Workshop',
      description: 'Practical session covering smart contract development.',
      speakers: ['Alice Developer'],
        venueMarkerId: 'h2-room',
    },
    {
      id: 'live-panel',
      start: offsetISO(-10),
      end: offsetISO(50),
      title: 'Parachain Ecosystem Panel',
      description: 'Leaders from top parachains discuss the road ahead.',
      speakers: ['Charlie Architect', 'Diana Protocol'],
        venueMarkerId: 'studio-2',
    },
    {
      id: 'upcoming-1',
      start: offsetISO(60),
      end: offsetISO(120),
      title: 'PAPI Deep Dive',
      description: 'Advanced patterns for Polkadot API usage.',
      speakers: ['Bob Engineer'],
        venueMarkerId: 'studio-1',
    },
    {
      id: 'upcoming-2',
      start: offsetISO(180),
      end: offsetISO(300),
      title: 'Welcome Reception',
      description: 'Networking and refreshments.',
      speakers: [],
        venueMarkerId: 'bar-gr',
    },
  ]
}

export function useMockFestival() {
  return {
    metadata: MOCK_FESTIVAL_METADATA,
    schedule: MOCK_SCHEDULE,
    venueMap: MOCK_VENUE_MAP,
    isLoading: false,
    error: null as string | null,
  }
}
