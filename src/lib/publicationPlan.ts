import { parsePrReferenceLinks, type PrEntryAssignee, type PrEntryStatus, type PrReferenceLink } from './prCalendar.ts'

export interface PublicationRow {
  id: string; title: string; event_id: string | null; awareness_post_id: string | null
  entry_kind: string; status: PrEntryStatus; scheduled_date: string; scheduled_time: string | null
  channels: string[] | null; reference_links: unknown; reference_label: string | null; reference_url: string | null
  assignees: { profile_id: string; assignment_source: PrEntryAssignee['assignmentSource'] }[]
}
export interface SharedLink { id: string; label: string; url: string }
export function publicationLinks(row: PublicationRow): PrReferenceLink[] {
  return parsePrReferenceLinks(row.reference_links, row.reference_label, row.reference_url)
}
export function uniqueAssigneeIds(assignees: PrEntryAssignee[]): string[] {
  return [...new Set(assignees.map(a => a.profileId))]
}
export function assigneeRoles(assignees: PrEntryAssignee[], profileId: string): string {
  const labels = { manual: 'İçeriğe atanan', event_owner: 'Etkinlik yetkilisi', awareness_responsible: 'Farkındalık yetkilisi' }
  return [...new Set(assignees.filter(a => a.profileId === profileId).map(a => labels[a.assignmentSource]))].join(' · ')
}
export function planCreationUrl(kind: 'event' | 'awareness', id: string): string {
  return `/app/takvimler/pr?new=1&${kind}=${encodeURIComponent(id)}`
}

export function publicationProgress(rows: PublicationRow[], now = new Date()) {
  const publications = rows.filter(r => r.entry_kind === 'publication' && r.status !== 'cancelled')
  const shared = publications.length > 0 && publications.every(r => r.status === 'completed')
  const delayed = publications.some(r => r.status !== 'completed' &&
    new Date(`${r.scheduled_date}T${r.scheduled_time ?? '23:59:59'}+03:00`).getTime() < now.getTime())
  return { shared, delayed, plannedCount: publications.length }
}
