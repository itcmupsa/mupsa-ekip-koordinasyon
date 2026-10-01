/** Shared date-only helpers for calendar source references. */

export type AwarenessCalendarReference =
  | { kind: 'day'; date: string }
  | { kind: 'range'; start: string; end: string }

/** Accept only real, canonical YYYY-MM-DD date keys (not timestamps). */
export function dateKeyOrNull(value: string | null | undefined): string | null {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null

  const [year, month, day] = value.split('-').map(Number)
  const parsed = new Date(Date.UTC(year, month - 1, day))
  if (
    parsed.getUTCFullYear() !== year ||
    parsed.getUTCMonth() !== month - 1 ||
    parsed.getUTCDate() !== day
  ) return null

  return value
}

/** True when two inclusive date-only ranges share at least one calendar day. */
export function dateRangeIntersects(
  start: string | null | undefined,
  end: string | null | undefined,
  visibleStart: string | null | undefined,
  visibleEnd: string | null | undefined,
): boolean {
  const rangeStart = dateKeyOrNull(start)
  const rangeEnd = dateKeyOrNull(end)
  const windowStart = dateKeyOrNull(visibleStart)
  const windowEnd = dateKeyOrNull(visibleEnd)
  if (!rangeStart || !rangeEnd || !windowStart || !windowEnd) return false
  if (rangeStart > rangeEnd || windowStart > windowEnd) return false
  return rangeStart <= windowEnd && rangeEnd >= windowStart
}

/** Event date used as its calendar reference; preparation dates are intentionally excluded. */
export function getEventReferenceDate(
  confirmedDate: string | null | undefined,
  estimatedDate: string | null | undefined,
): string | null {
  return dateKeyOrNull(confirmedDate) ?? dateKeyOrNull(estimatedDate)
}

/**
 * Derive the source marker or ongoing range for an awareness record.
 * A missing start date falls back to the share date; a valid start without an
 * end is shown as a single source marker. Invalid or reversed ranges are omitted.
 */
export function classifyAwarenessReference(
  startDate: string | null | undefined,
  endDate: string | null | undefined,
  shareDate: string | null | undefined,
): AwarenessCalendarReference | null {
  const start = dateKeyOrNull(startDate)
  const end = dateKeyOrNull(endDate)

  if (start && end) {
    if (start > end) return null
    if (start === end) return { kind: 'day', date: start }
    return { kind: 'range', start, end }
  }

  // A malformed explicit endpoint must not be reinterpreted as a valid day.
  if (endDate && !end) return null
  if (start) return { kind: 'day', date: start }
  if (startDate && !start) return null

  const share = dateKeyOrNull(shareDate)
  return share ? { kind: 'day', date: share } : null
}

/** Keep the first occurrence for each caller-defined source identity. */
export function uniqueByIdentity<T>(items: readonly T[], identity: (item: T) => string): T[] {
  const seen = new Set<string>()
  const unique: T[] = []
  for (const item of items) {
    const key = identity(item)
    if (seen.has(key)) continue
    seen.add(key)
    unique.push(item)
  }
  return unique
}

/** Count source records once, regardless of how many visual date markers they produce. */
export function countDistinctSources<T>(items: readonly T[], identity: (item: T) => string): number {
  return new Set(items.map(identity)).size
}

/** PR-scoped manual records keep their existing cards; other active records are references only.
 * A record with both source scopes uses the event layer once, rather than two copies.
 */
export function partitionManualCalendarRecords<T extends { id: string; calendar_scopes: readonly string[]; deleted_at: string | null }>(records: readonly T[]) {
  const pr: T[] = []
  const events: T[] = []
  const awareness: T[] = []
  for (const record of uniqueByIdentity(records, item => item.id)) {
    if (record.calendar_scopes.includes('pr')) pr.push(record)
    else if (!record.deleted_at) {
      if (record.calendar_scopes.includes('events')) events.push(record)
      else if (record.calendar_scopes.includes('awareness')) awareness.push(record)
    }
  }
  return { pr, events, awareness }
}

/** Source details must belong to the currently displayed week or month. */
export function isReferenceVisible(reference: AwarenessCalendarReference, start: string, end: string): boolean {
  return reference.kind === 'day'
    ? dateRangeIntersects(reference.date, reference.date, start, end)
    : dateRangeIntersects(reference.start, reference.end, start, end)
}

/** One upcoming occurrence for a manual range, including ranges already in progress. */
export function upcomingRangeDate(start: string, end: string | null, today: string): string | null {
  const first = dateKeyOrNull(start)
  const last = dateKeyOrNull(end ?? start)
  const current = dateKeyOrNull(today)
  if (!first || !last || !current || first > last || last < current) return null
  return first < current ? current : first
}
