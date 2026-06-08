import type { FestivalMetadata, SubEventMetadata } from './schemas'

export interface ValidationResult {
  valid: boolean
  errors: string[]
}

export function validateFestivalMetadata(data: unknown): ValidationResult {
  const errors: string[] = []
  if (!data || typeof data !== 'object') {
    return { valid: false, errors: ['Data must be an object'] }
  }

  const d = data as Record<string, unknown>

  if (d.type !== 'festival') errors.push('type must be "festival"')
  if (typeof d.name !== 'string' || !d.name) errors.push('name is required')
  if (typeof d.description !== 'string') errors.push('description is required')
  if (typeof d.organizer !== 'string' || !d.organizer) errors.push('organizer is required')
  if (!d.location || typeof d.location !== 'object') errors.push('location is required')
  if (!Array.isArray(d.tags)) errors.push('tags must be an array')
  if (!Array.isArray(d.schedule)) errors.push('schedule must be an array')

  return { valid: errors.length === 0, errors }
}

export function validateSubEventMetadata(data: unknown): ValidationResult {
  const errors: string[] = []
  if (!data || typeof data !== 'object') {
    return { valid: false, errors: ['Data must be an object'] }
  }

  const d = data as Record<string, unknown>

  if (d.type !== 'sub-event') errors.push('type must be "sub-event"')
  if (typeof d.name !== 'string' || !d.name) errors.push('name is required')
  if (typeof d.description !== 'string') errors.push('description is required')
  if (!Array.isArray(d.speakers)) errors.push('speakers must be an array')

  return { valid: errors.length === 0, errors }
}
