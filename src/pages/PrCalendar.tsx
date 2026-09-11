import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import type { Session } from '@supabase/supabase-js'
import { Link, useSearchParams } from 'react-router-dom'
import CalendarTabs from '../components/calendar/CalendarTabs'
import ManualCalendarEntryDialog, { type ManualCalendarRecord } from '../components/calendar/ManualCalendarEntryDialog'
import AppShell from '../components/AppShell'
import { useMembershipStatus } from '../hooks/useMembershipStatus'
import { supabase } from '../lib/supabaseClient'
import { PR_COLOR_PRESETS, PR_ENTRY_KINDS, PR_ENTRY_STATUSES, addDays, dateKeyInIstanbul, formatOptionalTime, isHexColor, isSafeExternalUrl, mondayOfWeek, parseDateOnly, shiftMonth, weekDates, type PrEntryKind, type PrEntryStatus } from '../lib/prCalendar'

type LoadState = 'loading' | 'ready' | 'error'
type ViewMode = 'week' | 'month'

interface PrEntry {
  id: string
  periodId: string
  title: string
  entryKind: PrEntryKind
  scheduledDate: string
  scheduledTime: string | null
  color: string
  status: PrEntryStatus
  channel: string | null
  format: string | null
  notes: string | null
  responsibleId: string | null
  eventId: string | null
  awarenessPostId: string | null
  taskId: string | null
  relatedPrEntryId: string | null
  referenceUrl: string | null
  deletedAt: string | null
  manualRecord?: ManualCalendarRecord
}

interface Member { id: string; name: string }
interface Source { id: string; title: string; eventId?: string | null; awarenessPostId?: string | null }

const DAY_SHORT = ['Pzt', 'Sal', 'Çar', 'Per', 'Cum', 'Cmt', 'Paz']
const emptyDraft = () => ({ title: '', entryKind: 'publication' as PrEntryKind, scheduledDate: dateKeyInIstanbul(), scheduledTime: '', color: '#166534', status: 'planned' as PrEntryStatus, channel: '', format: '', notes: '', responsibleId: '', eventId: '', awarenessPostId: '', taskId: '', relatedPrEntryId: '', referenceUrl: '' })

function labelFor<T extends string>(options: Array<{ value: T; label: string }>, value: T) { return options.find((item) => item.value === value)?.label ?? value }
function dayLabel(value: string) { return new Intl.DateTimeFormat('tr-TR', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC' }).format(parseDateOnly(value)) }
function fullDate(value: string) { return new Intl.DateTimeFormat('tr-TR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' }).format(parseDateOnly(value)) }
function monthLabel(value: string) { return new Intl.DateTimeFormat('tr-TR', { month: 'long', year: 'numeric', timeZone: 'UTC' }).format(parseDateOnly(value)) }
function statusClass(status: PrEntryStatus) { return status === 'completed' ? 'bg-emerald-50 text-emerald-700' : status === 'cancelled' ? 'bg-stone-100 text-stone-600' : status === 'ready' ? 'bg-sky-50 text-sky-700' : 'bg-amber-50 text-amber-800' }
function sortEntries(items: PrEntry[]) { return [...items].sort((a, b) => (a.scheduledTime ?? '').localeCompare(b.scheduledTime ?? '') || a.title.localeCompare(b.title, 'tr')) }

function CenteredMessage({ text }: { text: string }) { return <div className="flex min-h-screen items-center justify-center bg-canvas px-4"><p className="max-w-md text-center text-sm text-ink-soft">{text}</p></div> }
function Icon({ children }: { children: ReactNode }) { return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4" aria-hidden="true">{children}</svg> }

export default function PrCalendar({ session }: { session: Session }) {
  const { displayName, hasActiveMembership, periodId, periodLabel, appRole, coordinatorRoleName, profileId, loading: statusLoading } = useMembershipStatus(session)
  const [searchParams] = useSearchParams()
  const [manualOpen, setManualOpen] = useState(false)
  const [manualSelection, setManualSelection] = useState<ManualCalendarRecord | null>(null)
  const [editing, setEditing] = useState(false)
  const boardRef = useRef<HTMLDivElement | null>(null)
  const [selectedDay, setSelectedDay] = useState(dateKeyInIstanbul)
  const [loadState, setLoadState] = useState<LoadState>('loading')
  const [loadError, setLoadError] = useState<string | null>(null)
  const [entries, setEntries] = useState<PrEntry[]>([])
  const [members, setMembers] = useState<Member[]>([])
  const [events, setEvents] = useState<Source[]>([])
  const [awareness, setAwareness] = useState<Source[]>([])
  const [tasks, setTasks] = useState<Source[]>([])
  const [canManage, setCanManage] = useState(false)
  const [reloadKey, setReloadKey] = useState(0)
  const [weekStart, setWeekStart] = useState(() => mondayOfWeek(dateKeyInIstanbul()))
  const [view, setView] = useState<ViewMode>('week')
  const [month, setMonth] = useState(() => dateKeyInIstanbul().slice(0, 8) + '01')
  const [selected, setSelected] = useState<PrEntry | null>(null)
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [draft, setDraft] = useState(emptyDraft)
  const [formError, setFormError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [statusFilter, setStatusFilter] = useState<'all' | PrEntryStatus>('all')
  const [kindFilter, setKindFilter] = useState<'all' | PrEntryKind>('all')
  const [responsibleFilter, setResponsibleFilter] = useState('all')
  const [query, setQuery] = useState('')
  const [showDeleted, setShowDeleted] = useState(false)
  const returnFocus = useRef<HTMLElement | null>(null)
  const dialogRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    if (statusLoading || !periodId) return
    let active = true
    async function load() {
      setLoadState('loading'); setLoadError(null)
      const [entryResult, memberResult, eventResult, awarenessResult, taskResult, permissionResult, manualResult] = await Promise.all([
        (showDeleted ? supabase.from('pr_calendar_entries').select('*').eq('period_id', periodId).order('scheduled_date').order('scheduled_time', { nullsFirst: false }) : supabase.from('pr_calendar_entries').select('*').eq('period_id', periodId).is('deleted_at', null).order('scheduled_date').order('scheduled_time', { nullsFirst: false })),
        supabase.from('period_memberships').select('profile_id, period_display_name').eq('period_id', periodId).eq('is_active', true).order('period_display_name'),
        supabase.from('events').select('id, title').eq('period_id', periodId).is('deleted_at', null).order('title'),
        supabase.from('awareness_posts').select('id, awareness_name').eq('period_id', periodId).is('deleted_at', null).order('awareness_name'),
        supabase.from('tasks').select('id, title, event_id, awareness_post_id').eq('period_id', periodId).is('deleted_at', null).order('title'),
        supabase.rpc('can_manage_pr_calendar', { target_period_id: periodId }),
        (showDeleted ? supabase.from('calendar_entries').select('*').eq('period_id', periodId).contains('calendar_scopes', ['pr']) : supabase.from('calendar_entries').select('*').eq('period_id', periodId).contains('calendar_scopes', ['pr']).is('deleted_at', null)),
      ])
      if (!active) return
      if (entryResult.error) {
        setLoadState('error')
        setLoadError(entryResult.error.message.includes('pr_calendar_entries') ? 'Basın-yayın takvimi henüz kullanıma açılmadı. Veritabanı güncellemesi tamamlandıktan sonra tekrar deneyin.' : entryResult.error.message)
        return
      }
      if (memberResult.error || eventResult.error || awarenessResult.error || taskResult.error || manualResult.error || permissionResult.error) { setLoadState('error'); setLoadError('Takvim için bağlı kayıtlar yüklenemedi.'); return }
      const prEntries = (entryResult.data ?? []).map((row) => ({ id: row.id, periodId: row.period_id, title: row.title, entryKind: row.entry_kind, scheduledDate: row.scheduled_date, scheduledTime: row.scheduled_time, color: row.color, status: row.status, channel: row.channel, format: row.format, notes: row.notes, responsibleId: row.responsible_id, eventId: row.event_id, awarenessPostId: row.awareness_post_id, taskId: row.task_id, relatedPrEntryId: row.related_pr_entry_id, referenceUrl: row.reference_url, deletedAt: row.deleted_at } as PrEntry))
      const manualItems: PrEntry[] = (manualResult.data ?? []).flatMap((row: ManualCalendarRecord) => {
        const items: PrEntry[] = []
        for (let day = row.start_date; day <= (row.end_date ?? row.start_date); day = addDays(day, 1)) {
          items.push({ id: `manual-${row.id}-${day}`, periodId: row.period_id, title: row.title, entryKind: 'other', scheduledDate: day, scheduledTime: null, color: row.color, status: 'planned', channel: null, format: 'Manuel kayıt', notes: row.note, responsibleId: null, eventId: null, awarenessPostId: null, taskId: null, relatedPrEntryId: null, referenceUrl: null, deletedAt: row.deleted_at, manualRecord: row })
        }
        return items
      })
      setEntries([...prEntries, ...manualItems])
      setMembers((memberResult.data ?? []).map((row) => ({ id: row.profile_id, name: row.period_display_name || 'Üye' })))
      setEvents((eventResult.data ?? []).map((row) => ({ id: row.id, title: row.title })))
      setAwareness((awarenessResult.data ?? []).map((row) => ({ id: row.id, title: row.awareness_name })))
      setTasks((taskResult.data ?? []).map((row) => ({ id: row.id, title: row.title, eventId: row.event_id, awarenessPostId: row.awareness_post_id })))
      setCanManage(permissionResult.data === true); setLoadState('ready')
    }
    void load(); return () => { active = false }
  }, [periodId, reloadKey, showDeleted, statusLoading])

  const closeDrawer = useCallback(() => { if (saving) return; setDrawerOpen(false); window.setTimeout(() => returnFocus.current?.focus(), 0) }, [saving])

  useEffect(() => {
    if (!drawerOpen) return
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const first = dialogRef.current?.querySelector<HTMLElement>('button, input, select, textarea, a[href]')
    first?.focus()
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') { event.preventDefault(); closeDrawer(); return }
      if (event.key !== 'Tab' || !dialogRef.current) return
      const focusable = [...dialogRef.current.querySelectorAll<HTMLElement>('button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), a[href]')]
      if (!focusable.length) return
      const index = focusable.indexOf(document.activeElement as HTMLElement)
      if (event.shiftKey && index <= 0) { event.preventDefault(); focusable[focusable.length - 1].focus() }
      else if (!event.shiftKey && index === focusable.length - 1) { event.preventDefault(); focusable[0].focus() }
    }
    document.addEventListener('keydown', onKeyDown)
    return () => { document.removeEventListener('keydown', onKeyDown); document.body.style.overflow = previousOverflow }
  }, [drawerOpen, closeDrawer])

  const filtered = useMemo(() => entries.filter((item) =>
    (showDeleted || !item.deletedAt) && (statusFilter === 'all' || item.status === statusFilter) && (kindFilter === 'all' || item.entryKind === kindFilter) && (responsibleFilter === 'all' || item.responsibleId === responsibleFilter) && (!query.trim() || `${item.title} ${item.channel ?? ''} ${item.format ?? ''}`.toLocaleLowerCase('tr').includes(query.toLocaleLowerCase('tr')))),
  [entries, kindFilter, query, responsibleFilter, showDeleted, statusFilter])
  const grouped = useMemo(() => new Map<string, PrEntry[]>(weekDates(weekStart).map((day) => [day, sortEntries(filtered.filter((item) => item.scheduledDate === day))])), [filtered, weekStart])
  const counts = useMemo(() => weekDates(weekStart).map((day) => ({ day, entries: grouped.get(day) ?? [] })), [grouped, weekStart])

  const openDrawer = useCallback((entry?: PrEntry, date?: string, trigger?: HTMLElement | null) => {
    if (entry?.manualRecord) { setManualSelection(entry.manualRecord); setManualOpen(true); return }
    if (!canManage && !entry) return
    setEditing(!entry)
    returnFocus.current = trigger ?? document.activeElement as HTMLElement
    setSelected(entry ?? null)
    setDraft(entry ? { title: entry.title, entryKind: entry.entryKind, scheduledDate: entry.scheduledDate, scheduledTime: entry.scheduledTime?.slice(0, 5) ?? '', color: entry.color, status: entry.status, channel: entry.channel ?? '', format: entry.format ?? '', notes: entry.notes ?? '', responsibleId: entry.responsibleId ?? '', eventId: entry.eventId ?? '', awarenessPostId: entry.awarenessPostId ?? '', taskId: entry.taskId ?? '', relatedPrEntryId: entry.relatedPrEntryId ?? '', referenceUrl: entry.referenceUrl ?? '' } : { ...emptyDraft(), scheduledDate: date ?? dateKeyInIstanbul() })
    setFormError(null); setDrawerOpen(true)
  }, [canManage])

  async function saveEntry() {
    if (!periodId || !profileId || !canManage || saving) return
    if (!draft.scheduledDate || Number.isNaN(parseDateOnly(draft.scheduledDate).getTime())) { setFormError('Geçerli bir tarih seçin.'); return }
    if (!draft.title.trim()) { setFormError('Başlık gerekli.'); return }
    if (!isHexColor(draft.color)) { setFormError('Renk #RRGGBB biçiminde olmalı.'); return }
    if (!isSafeExternalUrl(draft.referenceUrl)) { setFormError('Bağlantı http:// veya https:// ile başlamalı.'); return }
    if (draft.eventId && draft.awarenessPostId) { setFormError('Etkinlik ve farkındalık kaydı aynı anda seçilemez.'); return }
    setSaving(true); setFormError(null)
    const payload = { period_id: periodId, title: draft.title.trim(), entry_kind: draft.entryKind, scheduled_date: draft.scheduledDate, scheduled_time: draft.scheduledTime || null, color: draft.color, status: draft.status, channel: draft.channel.trim() || null, format: draft.format.trim() || null, notes: draft.notes.trim() || null, responsible_id: draft.responsibleId || null, event_id: draft.eventId || null, awareness_post_id: draft.awarenessPostId || null, task_id: draft.taskId || null, related_pr_entry_id: draft.relatedPrEntryId || null, reference_url: draft.referenceUrl.trim() || null }
    const result = selected ? await supabase.from('pr_calendar_entries').update(payload).eq('id', selected.id).select('id').single() : await supabase.from('pr_calendar_entries').insert({ ...payload, created_by: profileId })
    setSaving(false)
    if (result.error) { setFormError(result.error.message); return }
    setDrawerOpen(false); setReloadKey((value) => value + 1); window.setTimeout(() => returnFocus.current?.focus(), 0)
  }
  async function toggleDeleted(entry: PrEntry) {
    if (!profileId || !canManage || saving) return
    setSaving(true)
    const result = await supabase.rpc('set_pr_calendar_entry_inactive', { target_entry_id: entry.id, inactive: !entry.deletedAt })
    setSaving(false)
    if (result.error) { setFormError(result.error.message); return }
    setDrawerOpen(false); setReloadKey((value) => value + 1)
  }
  async function signOut() { await supabase.auth.signOut() }
  const openedFromLink = useRef('')
  useEffect(() => {
    const id = searchParams.get('entry')
    if (id && loadState === 'ready' && openedFromLink.current !== id) {
      const entry = entries.find(item => item.id === id && !item.manualRecord)
      if (entry) { openedFromLink.current = id; setWeekStart(mondayOfWeek(entry.scheduledDate)); setMonth(entry.scheduledDate.slice(0,8) + '01'); openDrawer(entry) }
    }
  }, [searchParams, entries, loadState, openDrawer])
  const goToday = () => { const today = dateKeyInIstanbul(); setWeekStart(mondayOfWeek(today)); setMonth(today.slice(0, 8) + '01') }
  const goPrev = () => view === 'week' ? setWeekStart((date) => addDays(date, -7)) : setMonth((date) => shiftMonth(date, -1))
  const goNext = () => view === 'week' ? setWeekStart((date) => addDays(date, 7)) : setMonth((date) => shiftMonth(date, 1))
  const memberName = (id: string | null) => members.find((member) => member.id === id)?.name ?? 'Atanmamış'

  if (statusLoading) return <CenteredMessage text="Basın-yayın takvimi yükleniyor…" />
  if (!hasActiveMembership || !periodId) return <CenteredMessage text="Aktif dönem üyeliğiniz bulunmuyor." />
  if (loadState === 'loading') return <CenteredMessage text="PR takvimi yükleniyor…" />
  if (loadState === 'error') return <CenteredMessage text={loadError ?? 'Basın-yayın takvimi yüklenemedi.'} />
  const roleLabel = coordinatorRoleName ?? (appRole === 'super_admin' ? 'Süper Yönetici' : 'Koordinatör')

  return <AppShell isSuperAdmin={appRole === 'super_admin'} displayName={displayName} roleLabel={roleLabel} onSignOut={() => void signOut()}>
    <main className="mx-auto max-w-[1600px] px-4 py-5 sm:px-6 lg:px-8 lg:py-7">
      <div className="mb-5 flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
        <div><p className="inline-flex rounded-full bg-brand-soft px-3 py-1 text-xs font-medium text-brand-dark">Aktif dönem: {periodLabel ?? 'Belirtilmedi'}</p><h1 className="mt-3 text-3xl font-semibold tracking-tight text-ink sm:text-4xl">PR Takvimi</h1><p className="mt-1 text-sm text-ink-soft">Yayın, çekim ve iletişim planını haftalık akışta yönet.</p></div>
        <div className="flex flex-wrap gap-2">{appRole === 'super_admin' ? <button type="button" onClick={() => setShowDeleted((value) => !value)} className="min-h-[42px] rounded-lg border border-canvas-border px-3 text-sm font-medium text-ink-soft">{showDeleted ? 'Aktif kayıtlar' : 'Pasifleri göster'}</button> : null}{appRole === 'super_admin' ? <button type="button" onClick={() => { setManualSelection(null); setManualOpen(true) }} className="min-h-11 rounded-lg border border-canvas-border px-3 text-sm font-medium">Manuel kayıt ekle</button> : null}{canManage ? <button type="button" onClick={(event) => openDrawer(undefined, dateKeyInIstanbul(), event.currentTarget)} className="min-h-[42px] rounded-lg bg-accent px-4 text-sm font-semibold text-white shadow-card">+ Yeni PR kaydı</button> : <span className="inline-flex min-h-[42px] items-center rounded-lg bg-stone-100 px-3 text-sm text-ink-soft">Görüntüleme izni</span>}</div>
      </div>
      <CalendarTabs />
      <section className="mt-5 rounded-2xl border border-canvas-border bg-white p-3 shadow-card sm:p-4">
        <div className="flex flex-col gap-3 border-b border-canvas-border pb-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-center gap-2"><button type="button" onClick={goPrev} aria-label="Önceki dönem" className="grid h-10 w-10 place-items-center rounded-lg border border-canvas-border text-ink-soft"><Icon><path d="m14 6-6 6 6 6" /></Icon></button><button type="button" onClick={goNext} aria-label="Sonraki dönem" className="grid h-10 w-10 place-items-center rounded-lg border border-canvas-border text-ink-soft"><Icon><path d="m10 6 6 6-6 6" /></Icon></button><button type="button" onClick={goToday} className="min-h-[40px] rounded-lg border border-canvas-border px-3 text-sm font-medium text-ink">Bugün</button><h2 className="ml-1 text-base font-semibold capitalize text-ink">{view === 'week' ? `${dayLabel(weekStart)} – ${dayLabel(addDays(weekStart, 6))}` : monthLabel(month)}</h2></div>
          <div className="flex rounded-lg bg-canvas p-1"><button type="button" onClick={() => { if (view !== 'week') { setView('week'); setWeekStart(mondayOfWeek(month)) } }} className={`min-h-[34px] rounded-md px-3 text-sm font-medium ${view === 'week' ? 'bg-white text-brand-dark shadow-sm' : 'text-ink-soft'}`}>Hafta</button><button type="button" onClick={() => { if (view !== 'month') { setView('month'); setMonth(weekStart.slice(0, 8) + '01') } }} className={`min-h-[34px] rounded-md px-3 text-sm font-medium ${view === 'month' ? 'bg-white text-brand-dark shadow-sm' : 'text-ink-soft'}`}>Ay</button></div>
        </div>
        <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-4"><input value={query} onChange={(event) => setQuery(event.target.value)} aria-label="PR kayıtlarında ara" placeholder="Başlık, kanal veya format ara" className="min-h-[42px] rounded-lg border border-canvas-border px-3 text-sm" /><select aria-label="Durum filtresi" value={statusFilter} onChange={(event) => setStatusFilter(event.target.value as typeof statusFilter)} className="min-h-[42px] rounded-lg border border-canvas-border px-3 text-sm"><option value="all">Tüm durumlar</option>{PR_ENTRY_STATUSES.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</select><select aria-label="Tür filtresi" value={kindFilter} onChange={(event) => setKindFilter(event.target.value as typeof kindFilter)} className="min-h-[42px] rounded-lg border border-canvas-border px-3 text-sm"><option value="all">Tüm türler</option>{PR_ENTRY_KINDS.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</select><select aria-label="Sorumlu filtresi" value={responsibleFilter} onChange={(event) => setResponsibleFilter(event.target.value)} className="min-h-[42px] rounded-lg border border-canvas-border px-3 text-sm"><option value="all">Tüm sorumlular</option>{members.map((member) => <option key={member.id} value={member.id}>{member.name}</option>)}</select></div>
        <div className="mt-4 grid grid-cols-7 gap-1 pb-2 lg:hidden">{counts.map(({ day, entries }) => <button type="button" key={day} onClick={() => { setSelectedDay(day); setView('week'); requestAnimationFrame(() => { const target = document.getElementById(`pr-day-${day}`); if (target && boardRef.current) boardRef.current.scrollTo({ left: target.offsetLeft - boardRef.current.offsetLeft, behavior: 'smooth' }) }) }} className="min-w-0 rounded-xl border border-canvas-border bg-canvas px-2 py-2 text-left"><span className="block text-xs text-ink-soft">{DAY_SHORT[(parseDateOnly(day).getUTCDay() + 6) % 7]}</span><span className="text-sm font-semibold">{parseDateOnly(day).getUTCDate()}</span><span className="mt-1 block text-xs text-brand-dark">{entries.length}</span><span className="flex gap-0.5 mt-1">{entries.slice(0,3).map(item => <span key={item.id} className="h-1.5 w-1.5 rounded-full" style={{backgroundColor:item.color}} />)}</span></button>)}</div>
        <p className="mt-3 text-sm text-ink-soft">{view === 'week' ? 'Bu hafta' : 'Bu ay'}: <strong>{filtered.filter(item => view === 'week' ? item.scheduledDate >= weekStart && item.scheduledDate <= addDays(weekStart, 6) : item.scheduledDate.startsWith(month.slice(0, 7))).length} kayıt</strong></p>
        {view === 'week' ? <div ref={boardRef} className="relative mt-4 max-h-[70dvh] overflow-auto"><div className="grid min-w-[1400px] xl:min-w-[1050px] grid-cols-7 border-l border-t border-canvas-border">{weekDates(weekStart).map((day, index) => <section id={`pr-day-${day}`} key={day} className={`min-h-[440px] ${day === selectedDay ? 'bg-brand-soft/30' : ''} border-b border-r border-canvas-border`}><header className={`sticky top-0 z-10 border-b border-canvas-border bg-white px-3 py-3 ${day === dateKeyInIstanbul() ? 'text-brand-dark' : ''}`}><p className="text-xs font-medium text-ink-soft">{DAY_SHORT[index]}</p><p className="text-lg font-semibold">{parseDateOnly(day).getUTCDate()}</p></header><div className="space-y-2 p-2">{(grouped.get(day) ?? []).map((entry) => <button type="button" key={entry.id} onClick={(event) => openDrawer(entry, undefined, event.currentTarget)} className={`w-full rounded-lg border p-2.5 text-left shadow-sm transition hover:-translate-y-px hover:shadow-card ${entry.deletedAt ? 'opacity-50' : ''}`} style={{ borderLeftWidth: 4, borderLeftColor: entry.color, backgroundColor: `${entry.color}0d` }}><span className="block text-xs font-semibold text-ink-soft">{formatOptionalTime(entry.scheduledTime)}</span><span className="mt-0.5 block line-clamp-2 text-sm font-semibold text-ink">{entry.title}</span><span className="mt-1 flex flex-wrap gap-1"><span className="rounded px-1.5 py-0.5 text-xs font-medium text-ink-soft">{entry.manualRecord ? 'Manuel kayıt' : labelFor(PR_ENTRY_KINDS, entry.entryKind)}</span><span className={`rounded px-1.5 py-0.5 text-xs font-medium ${statusClass(entry.status)}`}>{labelFor(PR_ENTRY_STATUSES, entry.status)}</span></span></button>)}{canManage ? <button type="button" onClick={(event) => openDrawer(undefined, day, event.currentTarget)} className="w-full rounded-lg border border-dashed border-canvas-border px-2 py-2 text-xs font-medium text-ink-soft hover:border-brand hover:text-brand-dark">+ Kayıt ekle</button> : null}</div></section>)}</div></div> : <MonthBoard month={month} entries={filtered} canManage={canManage} onDay={(day) => { setWeekStart(mondayOfWeek(day)); setSelectedDay(day); setView('week') }} onSelect={(entry, trigger) => openDrawer(entry, undefined, trigger)} onCreate={(day, trigger) => openDrawer(undefined, day, trigger)} />}
      </section>
    </main>
    {manualOpen ? <ManualCalendarEntryDialog session={session} scope="pr" entry={manualSelection} onClose={() => setManualOpen(false)} onSaved={() => { setManualOpen(false); setReloadKey(value => value + 1) }} /> : null}
    {drawerOpen ? <EntryDrawer ref={dialogRef} entry={selected} draft={draft} setDraft={setDraft} members={members} events={events} awareness={awareness} tasks={tasks} entries={entries} memberName={memberName} error={formError} saving={saving} canManage={canManage} editing={editing} onEdit={() => setEditing(true)} onClose={closeDrawer} onSave={() => void saveEntry()} onDelete={() => selected && void toggleDeleted(selected)} /> : null}
  </AppShell>
}

function MonthBoard({ month, entries, canManage, onSelect, onCreate, onDay }: { month: string; entries: PrEntry[]; canManage: boolean; onDay: (day: string) => void; onSelect: (entry: PrEntry, trigger: HTMLElement) => void; onCreate: (day: string, trigger: HTMLElement) => void }) {
  const first = parseDateOnly(month); const start = mondayOfWeek(month); const days = Array.from({ length: 42 }, (_, index) => addDays(start, index))
  return <div className="mt-4 overflow-x-auto"><div className="grid min-w-[840px] grid-cols-7 border-l border-t border-canvas-border">{DAY_SHORT.map((day) => <div key={day} className="border-b border-r border-canvas-border bg-canvas px-2 py-2 text-xs font-semibold text-ink-soft">{day}</div>)}{days.map((day) => { const dayEntries = sortEntries(entries.filter((entry) => entry.scheduledDate === day)); const inMonth = parseDateOnly(day).getUTCMonth() === first.getUTCMonth(); return <div key={day} className={`min-h-[126px] border-b border-r border-canvas-border p-2 ${inMonth ? 'bg-white' : 'bg-canvas/60'}`}><div className="mb-1 flex items-center justify-between"><span className={`text-xs font-semibold ${inMonth ? 'text-ink' : 'text-ink-soft'}`}>{parseDateOnly(day).getUTCDate()}</span>{canManage ? <button type="button" onClick={(event) => onCreate(day, event.currentTarget)} className="text-xs text-brand-dark" aria-label={`${day} için kayıt ekle`}>+</button> : null}</div>{dayEntries.slice(0, 3).map((entry) => <button type="button" key={entry.id} onClick={(event) => onSelect(entry, event.currentTarget)} className="mb-1 block w-full truncate rounded px-1.5 py-1 text-left text-xs font-medium text-ink" style={{ borderLeft: `3px solid ${entry.color}`, backgroundColor: `${entry.color}12` }}>{entry.scheduledTime ? `${formatOptionalTime(entry.scheduledTime)} ` : ''}{entry.title}</button>)}{dayEntries.length > 3 ? <button type="button" onClick={() => onDay(day)} className="min-h-9 text-xs text-brand-dark">+{dayEntries.length - 3} kayıt · Haftada aç</button> : null}</div> })}</div></div>
}

const EntryDrawer = ({ ref, entry, draft, setDraft, members, events, awareness, tasks, entries, memberName, error, saving, canManage, editing, onEdit, onClose, onSave, onDelete }: { ref: React.RefObject<HTMLDivElement | null>; entry: PrEntry | null; draft: ReturnType<typeof emptyDraft>; setDraft: React.Dispatch<React.SetStateAction<ReturnType<typeof emptyDraft>>>; members: Member[]; events: Source[]; awareness: Source[]; tasks: Source[]; entries: PrEntry[]; memberName: (id: string | null) => string; error: string | null; saving: boolean; canManage: boolean; editing: boolean; onEdit: () => void; onClose: () => void; onSave: () => void; onDelete: () => void }) => <div className="fixed inset-0 z-50 flex justify-end bg-ink/35 p-0 sm:p-4" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose() }}><div ref={ref} role="dialog" aria-modal="true" aria-labelledby="pr-entry-title" className="flex h-full w-full max-w-xl flex-col overflow-y-auto bg-white shadow-2xl sm:rounded-2xl">
  <header className="sticky top-0 z-10 flex items-center justify-between border-b border-canvas-border bg-white px-5 py-4"><div><p className="text-xs font-medium text-brand-dark">Basın-yayın kaydı</p><h2 id="pr-entry-title" className="text-lg font-semibold text-ink">{entry ? entry.title : 'Yeni kayıt'}</h2></div><button type="button" onClick={onClose} aria-label="Paneli kapat" className="grid h-10 w-10 place-items-center rounded-lg border border-canvas-border text-ink-soft"><Icon><path d="m6 6 12 12M18 6 6 18" /></Icon></button></header>
  {(!canManage || !editing) && entry ? <div><EntryDetails entry={entry} memberName={memberName} events={events} awareness={awareness} tasks={tasks} entries={entries} />{canManage ? <button type="button" onClick={onEdit} className="m-5 min-h-11 rounded-lg bg-brand-dark px-5 text-white">Düzenle</button> : null}</div> : <div className="space-y-4 p-5"><label className="block text-sm font-medium text-ink">Başlık<input maxLength={240} value={draft.title} onChange={(event) => setDraft((current) => ({ ...current, title: event.target.value }))} className="mt-1.5 min-h-[44px] w-full rounded-lg border border-canvas-border px-3 font-normal" /></label><div className="grid grid-cols-2 gap-3"><label className="text-sm font-medium">Tarih<input type="date" value={draft.scheduledDate} onChange={(event) => setDraft((current) => ({ ...current, scheduledDate: event.target.value }))} className="mt-1.5 min-h-[44px] w-full rounded-lg border border-canvas-border px-3 font-normal" /></label><label className="text-sm font-medium">Saat <span className="font-normal text-ink-soft">(isteğe bağlı)</span><input type="time" value={draft.scheduledTime} onChange={(event) => setDraft((current) => ({ ...current, scheduledTime: event.target.value }))} className="mt-1.5 min-h-[44px] w-full rounded-lg border border-canvas-border px-3 font-normal" /></label></div><div className="grid grid-cols-2 gap-3"><Select label="Tür" value={draft.entryKind} options={PR_ENTRY_KINDS} onChange={(value) => setDraft((current) => ({ ...current, entryKind: value as PrEntryKind }))} /><Select label="Durum" value={draft.status} options={PR_ENTRY_STATUSES} onChange={(value) => setDraft((current) => ({ ...current, status: value as PrEntryStatus }))} /></div><label className="block text-sm font-medium">Sorumlu<select value={draft.responsibleId} onChange={(event) => setDraft((current) => ({ ...current, responsibleId: event.target.value }))} className="mt-1.5 min-h-[44px] w-full rounded-lg border border-canvas-border px-3 font-normal"><option value="">Atanmamış</option>{members.map((member) => <option key={member.id} value={member.id}>{member.name}</option>)}</select></label><div><span className="text-sm font-medium">Renk</span><div className="mt-2 flex flex-wrap items-center gap-2">{PR_COLOR_PRESETS.map((color) => <button type="button" key={color} onClick={() => setDraft((current) => ({ ...current, color }))} aria-label={`${color} rengini seç`} className={`h-8 w-8 rounded-full border-2 ${draft.color === color ? 'border-ink ring-2 ring-brand/30' : 'border-white'}`} style={{ backgroundColor: color }} />)}<input type="color" value={draft.color} onChange={(event) => setDraft((current) => ({ ...current, color: event.target.value }))} aria-label="Özel renk seç" className="h-8 w-10 rounded border border-canvas-border" /></div></div><div className="grid grid-cols-2 gap-3"><Text label="Kanal" value={draft.channel} onChange={(value) => setDraft((current) => ({ ...current, channel: value }))} /><Text label="Format" value={draft.format} onChange={(value) => setDraft((current) => ({ ...current, format: value }))} /></div><label className="block text-sm font-medium">Harici bağlantı<input type="url" value={draft.referenceUrl} onChange={(event) => setDraft((current) => ({ ...current, referenceUrl: event.target.value }))} placeholder="https://…" className="mt-1.5 min-h-[44px] w-full rounded-lg border border-canvas-border px-3 font-normal" /></label><div className="grid gap-3"><Select label="İlgili etkinlik" value={draft.eventId} options={[{ value: '', label: 'Seçilmedi' }, ...events]} onChange={(value) => setDraft((current) => ({ ...current, eventId: value, awarenessPostId: value ? '' : current.awarenessPostId, taskId: '' }))} /><Select label="İlgili farkındalık" value={draft.awarenessPostId} options={[{ value: '', label: 'Seçilmedi' }, ...awareness]} onChange={(value) => setDraft((current) => ({ ...current, awarenessPostId: value, eventId: value ? '' : current.eventId, taskId: '' }))} /><Select label="İlgili görev" value={draft.taskId} options={[{ value: '', label: 'Seçilmedi' }, ...tasks]} onChange={(value) => setDraft((current) => ({ ...current, taskId: value, eventId: value ? tasks.find(t => t.id === value)?.eventId ?? '' : current.eventId, awarenessPostId: value ? tasks.find(t => t.id === value)?.awarenessPostId ?? '' : current.awarenessPostId }))} /><Select label="İlgili PR kaydı" value={draft.relatedPrEntryId} options={[{ value: '', label: 'Seçilmedi' }, ...entries.filter((item) => !item.manualRecord && !item.deletedAt && item.id !== entry?.id).map((item) => ({ value: item.id, label: item.title }))]} onChange={(value) => setDraft((current) => ({ ...current, relatedPrEntryId: value }))} /></div><label className="block text-sm font-medium">Notlar<textarea value={draft.notes} onChange={(event) => setDraft((current) => ({ ...current, notes: event.target.value }))} rows={4} className="mt-1.5 w-full rounded-lg border border-canvas-border px-3 py-2 font-normal" /></label>{error ? <p role="alert" className="rounded-lg bg-danger-soft px-3 py-2 text-sm text-danger">{error}</p> : null}<div className="flex flex-wrap justify-between gap-2 border-t border-canvas-border pt-4">{entry ? <button type="button" onClick={onDelete} disabled={saving} className="min-h-[42px] rounded-lg border border-red-200 px-3 text-sm font-semibold text-danger">{entry.deletedAt ? 'Geri yükle' : 'Pasifleştir'}</button> : <span /> }<button type="button" onClick={onSave} disabled={saving} className="min-h-[42px] rounded-lg bg-accent px-4 text-sm font-semibold text-white disabled:opacity-60">{saving ? 'Kaydediliyor…' : 'Kaydet'}</button></div></div>}
  {canManage && editing && entry ? <EntryDetails entry={entry} memberName={memberName} events={events} awareness={awareness} tasks={tasks} entries={entries} /> : null}
</div></div>

function Select({ label, value, options, onChange }: { label: string; value: string; options: Array<{ value: string; label: string } | Source>; onChange: (value: string) => void }) { return <label className="block text-sm font-medium">{label}<select value={value} onChange={(event) => onChange(event.target.value)} className="mt-1.5 min-h-[44px] w-full rounded-lg border border-canvas-border px-3 font-normal">{options.map((option) => <option key={'id' in option ? option.id : option.value} value={'id' in option ? option.id : option.value}>{'title' in option ? option.title : option.label}</option>)}</select></label> }
function Text({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) { return <label className="block text-sm font-medium">{label}<input value={value} onChange={(event) => onChange(event.target.value)} className="mt-1.5 min-h-[44px] w-full rounded-lg border border-canvas-border px-3 font-normal" /></label> }
function EntryDetails({ entry, memberName, events, awareness, tasks, entries }: { entry: PrEntry; memberName: (id: string | null) => string; events: Source[]; awareness: Source[]; tasks: Source[]; entries: PrEntry[] }) { const source = (list: Source[], id: string | null) => list.find((item) => item.id === id)?.title; return <div className="space-y-4 p-5"><div className="flex flex-wrap gap-2"><span className="rounded-full bg-canvas px-2.5 py-1 text-xs font-medium">{formatOptionalTime(entry.scheduledTime)} · {fullDate(entry.scheduledDate)}</span><span className={`rounded-full px-2.5 py-1 text-xs font-medium ${statusClass(entry.status)}`}>{labelFor(PR_ENTRY_STATUSES, entry.status)}</span></div><p className="text-sm text-ink-soft">Sorumlu: <span className="font-medium text-ink">{memberName(entry.responsibleId)}</span></p>{entry.channel || entry.format ? <p className="text-sm text-ink-soft">{[entry.channel, entry.format].filter(Boolean).join(' · ')}</p> : null}{entry.notes ? <p className="whitespace-pre-wrap rounded-lg bg-canvas p-3 text-sm text-ink">{entry.notes}</p> : null}<div className="space-y-2 text-sm">{entry.eventId ? <Link to={`/app/etkinlikler/${entry.eventId}`} className="block text-brand-dark underline">Etkinlik: {source(events, entry.eventId) ?? 'Kaydı aç'}</Link> : null}{entry.awarenessPostId ? <Link to={`/app/farkindalik?record=${entry.awarenessPostId}`} className="block text-brand-dark underline">Farkındalık: {source(awareness, entry.awarenessPostId) ?? 'Kaydı aç'}</Link> : null}{entry.taskId ? <Link to={`/app/gorevler?task=${entry.taskId}`} className="block text-brand-dark underline">Görev: {source(tasks, entry.taskId) ?? 'Kaydı aç'}</Link> : null}{entry.relatedPrEntryId ? <Link to={`/app/takvimler/pr?entry=${entry.relatedPrEntryId}`} className="block text-brand-dark underline">Bağlı PR kaydı: {entries.find((item) => item.id === entry.relatedPrEntryId)?.title ?? 'Kayıt'}</Link> : null}{entry.referenceUrl && isSafeExternalUrl(entry.referenceUrl) ? <a href={entry.referenceUrl} target="_blank" rel="noreferrer" className="block text-brand-dark underline">Harici bağlantıyı aç</a> : null}</div></div> }
