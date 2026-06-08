/** Soft cap for announcement history per channel before oldest entries drop. */
export const CHANNEL_ANNOUNCEMENT_SOFT_CAP = 500

/**
 * UX cap on announcement body length (chars). Not a chain-level limit. The
 * Bulletin store accepts much larger payloads. Used by admin composers for
 * input validation and live char counters.
 */
export const ANNOUNCEMENT_CONTENT_MAX_CHARS = 2000
