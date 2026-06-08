/**
 * Session time-window logic, shared by create, edit, and submit-time validation.
 *
 * All times pinned to Europe/Berlin (auto-DST via Intl). Rules:
 *   - Sessions are 15-minute aligned (`:00 / :15 / :30 / :45`).
 *   - Min duration 15 min, max duration 2 hours.
 *   - Earliest start 09:00 Berlin, latest end 22:00 Berlin.
 *   - Must fit within the festival's [startTime, endTime] window.
 *   - No past times: if the chosen day is today, only slots strictly in the future qualify
 *     (round-up to next :15. At 14:01 the next valid start is 14:15; at 14:15:00 sharp it is 14:15).
 *
 * Times are represented as "minutes-of-day" integers (0..1439). Display is derived
 * (`Math.floor(m/60)` + `m % 60`); store one number per endpoint.
 */

const BERLIN_TZ = 'Europe/Berlin'
export const DAY_START_HOUR = 9
export const DAY_END_HOUR = 22
export const SLOT_MIN = 15
export const MIN_DURATION_MIN = 15
export const MAX_DURATION_MIN = 120

const DAY_START_MIN = DAY_START_HOUR * 60
const DAY_END_MIN = DAY_END_HOUR * 60

export interface FestivalDay {
  /** YYYY-MM-DD in Berlin */
  dateKey: string
  /** "Day 1", "Day 2", ... */
  label: string
  /** "Thursday, 18 June" */
  longLabel: string
}

export interface SessionTimeRange {
  /** Berlin date key YYYY-MM-DD */
  dateKey: string
  /** Berlin local minutes-of-day, multiple of 15, in [DAY_START_MIN, DAY_END_MIN - MIN_DURATION_MIN] */
  startMinutesOfDay: number
  /** Berlin local minutes-of-day, multiple of 15, in [start + MIN_DURATION_MIN, min(start + MAX_DURATION_MIN, DAY_END_MIN)] */
  endMinutesOfDay: number
}

interface BerlinParts {
  year: number
  month: number
  day: number
  hour: number
  minute: number
  second: number
  weekday: string
}

const WEEKDAY_LONG: Record<string, string> = {
  Sun: 'Sunday', Mon: 'Monday', Tue: 'Tuesday', Wed: 'Wednesday',
  Thu: 'Thursday', Fri: 'Friday', Sat: 'Saturday',
}

const MONTH_LONG = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
]

const partsFmt = new Intl.DateTimeFormat('en-US', {
  timeZone: BERLIN_TZ,
  year: 'numeric', month: '2-digit', day: '2-digit',
  hour: '2-digit', minute: '2-digit', second: '2-digit',
  hour12: false, weekday: 'short',
})

function berlinPartsOf(d: Date): BerlinParts {
  const map: Record<string, string> = {}
  for (const p of partsFmt.formatToParts(d)) {
    if (p.type !== 'literal') map[p.type] = p.value
  }
  return {
    year: Number(map.year),
    month: Number(map.month),
    day: Number(map.day),
    hour: Number(map.hour) % 24,
    minute: Number(map.minute),
    second: Number(map.second),
    weekday: map.weekday ?? 'Mon',
  }
}

function pad(n: number): string {
  return String(n).padStart(2, '0')
}

/** YYYY-MM-DD key in Berlin TZ for a given UTC instant. */
export function dateKeyOf(d: Date): string {
  const p = berlinPartsOf(d)
  return `${p.year}-${pad(p.month)}-${pad(p.day)}`
}

/**
 * Convert a Berlin-local (dateKey, hour, minute) into a UTC Date.
 * DST-aware via a single Intl round-trip. Safe for hours ≥ 4 (well clear of
 * the 02:00/03:00 DST transitions, which is fine since our grid is 09–22).
 */
export function berlinHourToDate(dateKey: string, hour: number, minute = 0): Date {
  const parts = dateKey.split('-').map(Number)
  const y = parts[0] ?? 1970
  const m = parts[1] ?? 1
  const d = parts[2] ?? 1
  const guessUtcMs = Date.UTC(y, m - 1, d, hour, minute, 0)
  const guess = new Date(guessUtcMs)
  const p = berlinPartsOf(guess)
  const guessAsBerlinUtcMs = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second)
  const offsetMs = guessAsBerlinUtcMs - guessUtcMs
  return new Date(guessUtcMs - offsetMs)
}

/** Convenience: minutes-of-day variant of berlinHourToDate. */
export function berlinMinuteToDate(dateKey: string, minutesOfDay: number): Date {
  return berlinHourToDate(dateKey, Math.floor(minutesOfDay / 60), minutesOfDay % 60)
}

/** Format a YYYY-MM-DD dateKey + parts into "Thursday, 18 June". */
function longLabelFor(dateKey: string): string {
  const noon = berlinHourToDate(dateKey, 12)
  const p = berlinPartsOf(noon)
  const weekday = WEEKDAY_LONG[p.weekday] ?? p.weekday
  const month = MONTH_LONG[p.month - 1]
  return `${weekday}, ${p.day} ${month}`
}

/** Step from one Berlin date key to the next calendar day. */
function nextDateKey(dateKey: string): string {
  const d = berlinHourToDate(dateKey, 12)
  const next = new Date(d.getTime() + 24 * 60 * 60 * 1000)
  return dateKeyOf(next)
}

/**
 * Enumerate Berlin calendar days that intersect the festival window AND still
 * have at least one legal start slot given `now`. Days entirely in the past or
 * with no remaining slot are excluded.
 */
export function getValidFestivalDays(
  festivalStart: Date,
  festivalEnd: Date,
  now: Date,
): FestivalDay[] {
  const startKey = dateKeyOf(festivalStart)
  const endKey = dateKeyOf(festivalEnd)

  const out: FestivalDay[] = []
  let key = startKey
  let dayIndex = 1
  for (let i = 0; i < 31; i++) {
    if (getValidStartSlots(key, festivalStart, festivalEnd, now).length > 0) {
      out.push({
        dateKey: key,
        label: `Day ${dayIndex}`,
        longLabel: longLabelFor(key),
      })
    }
    if (key === endKey) break
    key = nextDateKey(key)
    dayIndex += 1
  }
  return out
}

/**
 * Earliest legal Berlin minute-of-day on `dateKey`, given current real time `now`.
 * Round up to next :15:
 *   - If `now` is before this day, returns DAY_START_MIN.
 *   - If `now` is on this day at H:M:S → round up to next quarter; on a quarter sharp
 *     (M ∈ {0,15,30,45} with S=0), keep it.
 *   - If `now` is past this day, returns +Infinity (no slots).
 */
function earliestStartMinuteOnDay(dateKey: string, now: Date): number {
  const nowKey = dateKeyOf(now)
  if (nowKey < dateKey) return DAY_START_MIN
  if (nowKey > dateKey) return Number.POSITIVE_INFINITY
  const p = berlinPartsOf(now)
  const onQuarter = p.minute % SLOT_MIN === 0 && p.second === 0
  const baseMin = p.hour * 60 + p.minute
  if (onQuarter) return baseMin
  return Math.ceil((baseMin + 1) / SLOT_MIN) * SLOT_MIN
}

/**
 * Legal start slots (minutes-of-day, multiples of 15) for a given Berlin day,
 * filtered by festival window and the no-past-times rule. Ascending order.
 *
 * A start slot `s` is legal iff:
 *   - DAY_START_MIN ≤ s ≤ DAY_END_MIN - MIN_DURATION_MIN  (so a 15-min session fits in 09–22)
 *   - s % SLOT_MIN === 0
 *   - berlinMinuteToDate(day, s) ≥ festivalStart
 *   - berlinMinuteToDate(day, s + MIN_DURATION_MIN) ≤ festivalEnd  (at least the min duration fits)
 *   - s ≥ earliestStartMinuteOnDay(day, now)
 */
export function getValidStartSlots(
  dateKey: string,
  festivalStart: Date,
  festivalEnd: Date,
  now: Date,
): number[] {
  const earliest = Math.max(DAY_START_MIN, earliestStartMinuteOnDay(dateKey, now))
  const latestByCap = DAY_END_MIN - MIN_DURATION_MIN
  const out: number[] = []
  for (let s = earliest; s <= latestByCap; s += SLOT_MIN) {
    const startAt = berlinMinuteToDate(dateKey, s)
    const endAtMin = berlinMinuteToDate(dateKey, s + MIN_DURATION_MIN)
    if (startAt < festivalStart) continue
    if (endAtMin > festivalEnd) continue
    out.push(s)
  }
  return out
}

/**
 * Legal end slots (minutes-of-day, multiples of 15) for a chosen start.
 * Honors min/max duration, the 22:00 day cap, and `festivalEnd`.
 */
export function getValidEndSlots(
  dateKey: string,
  startMinutesOfDay: number,
  festivalEnd: Date,
): number[] {
  const out: number[] = []
  const lo = startMinutesOfDay + MIN_DURATION_MIN
  const hi = Math.min(startMinutesOfDay + MAX_DURATION_MIN, DAY_END_MIN)
  for (let e = lo; e <= hi; e += SLOT_MIN) {
    const endAt = berlinMinuteToDate(dateKey, e)
    if (endAt > festivalEnd) break
    out.push(e)
  }
  return out
}

/** Distinct hour buckets (sorted asc) present in a slot list. */
export function bucketHours(slots: number[]): number[] {
  const seen = new Set<number>()
  for (const s of slots) seen.add(Math.floor(s / 60))
  return [...seen].sort((a, b) => a - b)
}

/** Minutes (0/15/30/45) present in `slots` for a given hour bucket, ascending. */
export function minutesInHour(slots: number[], hour: number): number[] {
  const out: number[] = []
  for (const s of slots) {
    if (Math.floor(s / 60) === hour) out.push(s % 60)
  }
  return out.sort((a, b) => a - b)
}

export type SessionTimeValidation =
  | { ok: true; startAt: Date; endAt: Date }
  | { ok: false; reason: SessionTimeValidationFailReason }

export type SessionTimeValidationFailReason =
  | 'missing-fields'
  | 'invalid-day'
  | 'invalid-start'
  | 'invalid-end'
  | 'in-the-past'

/**
 * Re-check a chosen (dateKey, startMinutesOfDay, endMinutesOfDay) against the live
 * `now`, festival window, and all rules. Used at submit time to catch clock drift.
 */
export function validateSessionTime(
  range: Partial<SessionTimeRange>,
  festivalStart: Date,
  festivalEnd: Date,
  now: Date,
): SessionTimeValidation {
  const { dateKey, startMinutesOfDay, endMinutesOfDay } = range
  if (!dateKey || startMinutesOfDay == null || endMinutesOfDay == null) {
    return { ok: false, reason: 'missing-fields' }
  }
  const validDays = getValidFestivalDays(festivalStart, festivalEnd, now)
  if (!validDays.some((d) => d.dateKey === dateKey)) {
    return { ok: false, reason: 'invalid-day' }
  }
  const validStarts = getValidStartSlots(dateKey, festivalStart, festivalEnd, now)
  if (!validStarts.includes(startMinutesOfDay)) {
    const startAt = berlinMinuteToDate(dateKey, startMinutesOfDay)
    if (startAt < now) return { ok: false, reason: 'in-the-past' }
    return { ok: false, reason: 'invalid-start' }
  }
  const validEnds = getValidEndSlots(dateKey, startMinutesOfDay, festivalEnd)
  if (!validEnds.includes(endMinutesOfDay)) {
    return { ok: false, reason: 'invalid-end' }
  }
  return {
    ok: true,
    startAt: berlinMinuteToDate(dateKey, startMinutesOfDay),
    endAt: berlinMinuteToDate(dateKey, endMinutesOfDay),
  }
}

/** Format minutes-of-day as "H:MM" (no leading zero on hour, padded minutes). */
export function formatTimeLabel(minutesOfDay: number): string {
  const h = Math.floor(minutesOfDay / 60)
  const m = minutesOfDay % 60
  return `${h}:${pad(m)}`
}

/**
 * Format a duration in minutes as "45 min" / "1 hour" / "1 hour 15 min" / "2 hours".
 */
export function formatDurationLabel(minutes: number): string {
  if (minutes < 60) return `${minutes} min`
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  const hLabel = h === 1 ? '1 hour' : `${h} hours`
  if (m === 0) return hLabel
  return `${hLabel} ${m} min`
}
