import type { SubEventMetadata } from '../metadata/schemas'
import { generateBadge } from '../utils/badge'

/** Mock badge pixels generated from title + category */
export const MOCK_BADGE_PIXELS = generateBadge('Parachain Workshop', 'workshop')

export const MOCK_SUB_EVENT_METADATA: SubEventMetadata = {
  version: '1.0',
  type: 'sub-event',
  name: 'Parachain Workshop',
  description: 'Hands-on session building a custom parachain from scratch.',
  location: 'workshop-room-a',
  speakers: ['Alice Developer', 'Charlie Architect'],
  badgePixels: MOCK_BADGE_PIXELS,
}

export function useMockSubEvent() {
  return {
    metadata: MOCK_SUB_EVENT_METADATA,
    badgePixels: MOCK_BADGE_PIXELS,
    isLoading: false,
    error: null as string | null,
  }
}
