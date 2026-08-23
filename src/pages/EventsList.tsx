import { useCallback, useEffect, useMemo, useState } from 'react'
import type { Session } from '@supabase/supabase-js'
import { Link, useSearchParams } from 'react-router-dom'
import AppShell from '../components/AppShell'
import PermanentDeleteDialog from '../components/PermanentDeleteDialog'
import NewEventPanel from '../components/events/NewEventPanel'
import { useMembershipStatus } from '../hooks/useMembershipStatus'
import { supabase } from '../lib/supabaseClient'
import { coordinatorRolePresentation } from '../lib/coordinatorRolePresentation'
import { deleteEventPermanently } from '../lib/permanentDeletion'

interface EventRow {
  id: string
  title: string
  description: string | null
  eventStatus: string
  eventStatusSlug: string
  planningDate: string
  estimatedDate: string | null
  confirmedDate: string | null
  ownerName: string
  ownerRoleName: string | null
  ownerRoleId: string | null
  ownerRoleSlug: string | null
  deletedAt: string | null
}

interface CoordinatorRoleRelation {
  id: string
  name: string
  slug: string
}

interface ProfileRow {
  profile_id: string
  period_display_name: string
  coordinator_roles: CoordinatorRoleRelation | CoordinatorRoleRelation[] | null
}

interface StatusRow {
  slug: string
  label: string
}

type LoadState = 'loading' | 'ready' | 'error'
type CreateState = 'closed' | 'open' | 'submitting'

function formatDate(value: string | null) {
  if (!value) return 'Tarih henüz belirlenmedi'
  return new Intl.DateTimeFormat('tr-TR', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  }).format(new Date(`${value}T00:00:00`))
}

function eventDisplayDate(event: EventRow) {
  return event.confirmedDate ?? event.estimatedDate
}

function pickOne<T>(value: T | T[] | null | undefined): T | null {
  if (!value) return null
  return Array.isArray(value) ? (value[0] ?? null) : value
}

function statusClass(slug: string) {
  if (slug === 'confirmed' || slug === 'completed' || slug === 'reported') {
    return 'bg-brand-soft text-brand-dark'
  }
  if (slug === 'postponed' || slug === 'cancelled') {
    return 'bg-red-50 text-red-700'
  }
  if (slug === 'archived') return 'bg-canvas-border/60 text-ink-soft'
  return 'bg-accent-soft text-amber-800'
}

function CenteredMessage({ text }: { text: string }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-canvas px-4">
      <p className="text-center text-sm text-ink-soft">{text}</p>
    </div>
  )
}

function PlusIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4" aria-hidden="true">
      <circle cx="12" cy="12" r="9" />
      <path d="M12 8v8M8 12h8" />
    </svg>
  )
}

function FilterIcon() {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5" aria-hidden="true"><path d="M4 5h16l-6.2 7.1v5.4l-3.6 1.8v-7.2z" /></svg>
}

function CheckIcon() {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4" aria-hidden="true"><path d="m6.5 12.5 3.2 3.2 7.8-8" /></svg>
}

function CalendarIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4" aria-hidden="true">
      <rect x="3.5" y="4.5" width="17" height="16" rx="2" />
      <path d="M3.5 9.5h17M8 3v3M16 3v3" />
    </svg>
  )
}

function MoreIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className="h-5 w-5" aria-hidden="true">
      <circle cx="12" cy="5" r="1.7" />
      <circle cx="12" cy="12" r="1.7" />
      <circle cx="12" cy="19" r="1.7" />
    </svg>
  )
}

export default function EventsList({ session }: { session: Session }) {
  const [searchParams, setSearchParams] = useSearchParams()
  const {
    displayName,
    hasActiveMembership,
    profileId,
    periodId,
    periodLabel,
    appRole,
    coordinatorRoleName,
    loading: statusLoading,
  } = useMembershipStatus(session)
  const isSuperAdmin = appRole === 'super_admin'
  const [events, setEvents] = useState<EventRow[]>([])
  const [loadState, setLoadState] = useState<LoadState>('loading')
  const [reloadKey, setReloadKey] = useState(0)
  const [createState, setCreateState] = useState<CreateState>('closed')
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [planningDate, setPlanningDate] = useState(() => new Date().toISOString().slice(0, 10))
  const [estimatedDate, setEstimatedDate] = useState('')
  const [createError, setCreateError] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)
  const [selectedCoordinatorRoleId, setSelectedCoordinatorRoleId] = useState('all')
  const [showInactive, setShowInactive] = useState(false)
  const [updatingEventId, setUpdatingEventId] = useState<string | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<EventRow | null>(null)
  const [deleteError, setDeleteError] = useState<string | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)
  const [mobileActionEventId, setMobileActionEventId] = useState<string | null>(null)

  useEffect(() => {
    if (searchParams.get('create') !== '1') return
    setSuccessMessage(null)
    setCreateError(null)
    setCreateState('open')
    setSearchParams({}, { replace: true })
  }, [searchParams, setSearchParams])

  useEffect(() => {
    if (statusLoading) return
    if (!hasActiveMembership || !periodId) {
      setLoadState('ready')
      return
    }

    let isMounted = true
    async function loadEvents() {
      setLoadState('loading')

      let eventsQuery = supabase
        .from('events')
        .select('id, title, description, event_status, planning_date, estimated_date, confirmed_date, owner_id, deleted_at')
        .eq('period_id', periodId)
        .order('planning_date', { ascending: false })
      if (!showInactive || !isSuperAdmin) eventsQuery = eventsQuery.is('deleted_at', null)
      const { data: eventData, error: eventError } = await eventsQuery

      if (eventError) {
        if (isMounted) setLoadState('error')
        return
      }

      const eventRows = eventData ?? []
      const ownerIds = [...new Set(eventRows.map((event) => event.owner_id as string))]
      const statusSlugs = [...new Set(eventRows.map((event) => event.event_status as string))]
      const [profilesResult, statusesResult] = await Promise.all([
        ownerIds.length > 0
          ? supabase
              .from('period_memberships')
              .select('profile_id, period_display_name, coordinator_roles(id, name, slug)')
              .eq('period_id', periodId)
              .in('profile_id', ownerIds)
          : Promise.resolve({ data: [], error: null }),
        statusSlugs.length > 0
          ? supabase.from('event_statuses').select('slug, label').in('slug', statusSlugs)
          : Promise.resolve({ data: [], error: null }),
      ])

      if (!isMounted) return
      if (profilesResult.error || statusesResult.error) {
        setLoadState('error')
        return
      }

      const profiles = new Map(
        ((profilesResult.data ?? []) as ProfileRow[]).map((profile) => [
          profile.profile_id,
          {
            name: profile.period_display_name,
            roleId: pickOne(profile.coordinator_roles)?.id ?? null,
            roleName: pickOne(profile.coordinator_roles)?.name ?? null,
            roleSlug: pickOne(profile.coordinator_roles)?.slug ?? null,
          },
        ]),
      )
      const statuses = new Map(
        ((statusesResult.data ?? []) as StatusRow[]).map((status) => [status.slug, status.label]),
      )

      setEvents(
        eventRows.map((event) => ({
          id: event.id as string,
          title: event.title as string,
          description: (event.description as string | null) ?? null,
          eventStatus: statuses.get(event.event_status as string) ?? (event.event_status as string),
          eventStatusSlug: event.event_status as string,
          planningDate: event.planning_date as string,
          estimatedDate: (event.estimated_date as string | null) ?? null,
          confirmedDate: (event.confirmed_date as string | null) ?? null,
          ownerName: profiles.get(event.owner_id as string)?.name ?? 'Sorumlu belirtilmemiş',
          ownerRoleId: profiles.get(event.owner_id as string)?.roleId ?? null,
          ownerRoleName: profiles.get(event.owner_id as string)?.roleName ?? null,
          ownerRoleSlug: profiles.get(event.owner_id as string)?.roleSlug ?? null,
          deletedAt: (event.deleted_at as string | null) ?? null,
        })),
      )
      setLoadState('ready')
    }

    void loadEvents()
    return () => {
      isMounted = false
    }
  }, [hasActiveMembership, isSuperAdmin, periodId, reloadKey, showInactive, statusLoading])

  function openCreateForm() {
    setSuccessMessage(null)
    setCreateError(null)
    setCreateState('open')
  }

  const closeCreateForm = useCallback(() => {
    setCreateState('closed')
    setCreateError(null)
  }, [])

  const closeDeleteDialog = useCallback(() => {
    if (isDeleting) return
    setDeleteTarget(null)
    setDeleteError(null)
  }, [isDeleting])

  async function handlePermanentDelete() {
    if (!deleteTarget?.deletedAt) return
    setIsDeleting(true)
    setDeleteError(null)
    try {
      const result = await deleteEventPermanently(deleteTarget.id)
      setSuccessMessage(result.cleanupWarning ?? `“${deleteTarget.title}” etkinliği kalıcı olarak silindi.`)
      setDeleteTarget(null)
      setReloadKey((value) => value + 1)
    } catch (error) {
      setDeleteError(error instanceof Error ? error.message : 'Etkinlik silinemedi.')
    } finally {
      setIsDeleting(false)
    }
  }

  async function toggleEventActive(event: EventRow) {
    if (!isSuperAdmin || !profileId) return
    const deactivate = !event.deletedAt
    if (deactivate && !window.confirm('Bu etkinliği pasifleştirmek istediğinize emin misiniz? Bağlı görevler ve diğer kayıtlar da otomatik olarak pasifleştirilecek.')) return
    setUpdatingEventId(event.id)
    setSuccessMessage(null)
    const { error } = await supabase
      .from('events')
      .update(deactivate
        ? { deleted_at: new Date().toISOString(), deleted_by: profileId, deletion_note: 'Etkinlik pasifleştirildi' }
        : { deleted_at: null, deleted_by: null, deletion_note: null })
      .eq('id', event.id)
    setUpdatingEventId(null)
    if (error) {
      setSuccessMessage(error.message.toLowerCase().includes('kilit') ? 'Dönem kilitli olduğu için işlem yapılamadı.' : 'Etkinlik güncellenemedi.')
      return
    }
    setSuccessMessage(deactivate ? 'Etkinlik ve bağlı kayıtları pasifleştirildi.' : 'Etkinlik ve otomatik pasifleştirilen bağlı kayıtları yeniden aktifleştirildi.')
    setReloadKey((value) => value + 1)
  }

  async function handleCreateEvent() {
    setCreateError(null)
    if (!periodId || !profileId) {
      setCreateError('Aktif dönem veya kullanıcı bilgisi bulunamadı.')
      return
    }
    if (!title.trim()) {
      setCreateError('Etkinlik adı zorunludur.')
      return
    }
    if (!planningDate) {
      setCreateError('Planlama tarihi zorunludur.')
      return
    }

    setCreateState('submitting')
    const { error } = await supabase.from('events').insert({
      period_id: periodId,
      title: title.trim(),
      description: description.trim() || null,
      created_by: profileId,
      owner_id: profileId,
      planning_date: planningDate,
      estimated_date: estimatedDate || null,
    })

    if (error) {
      setCreateState('open')
      setCreateError('Etkinlik oluşturulamadı. Yetki veya dönem durumunu kontrol et.')
      return
    }

    setTitle('')
    setDescription('')
    setPlanningDate(new Date().toISOString().slice(0, 10))
    setEstimatedDate('')
    setCreateState('closed')
    setSuccessMessage('Etkinlik başarıyla oluşturuldu.')
    setReloadKey((current) => current + 1)
  }

  async function handleSignOut() {
    await supabase.auth.signOut()
  }

  const coordinatorRoleOptions = useMemo(() => {
    const options = new Map<string, { name: string; slug: string | null; count: number }>()
    for (const event of events) {
      if (!event.ownerRoleId || !event.ownerRoleName) continue
      const current = options.get(event.ownerRoleId)
      options.set(event.ownerRoleId, {
        name: event.ownerRoleName,
        slug: event.ownerRoleSlug,
        count: (current?.count ?? 0) + 1,
      })
    }
    return Array.from(options, ([id, option]) => ({ id, ...option })).sort((a, b) => a.name.localeCompare(b.name, 'tr-TR'))
  }, [events])

  const filteredEvents = useMemo(() => {
    const matchingEvents = selectedCoordinatorRoleId === 'all'
      ? events
      : events.filter((event) => event.ownerRoleId === selectedCoordinatorRoleId)
    const today = new Date()
    today.setHours(0, 0, 0, 0)

    return [...matchingEvents].sort((firstEvent, secondEvent) => {
      const firstDate = eventDisplayDate(firstEvent)
      const secondDate = eventDisplayDate(secondEvent)
      if (!firstDate || !secondDate) {
        if (firstDate !== secondDate) return firstDate ? -1 : 1
        return firstEvent.title.localeCompare(secondEvent.title, 'tr-TR')
      }
      const firstTime = new Date(`${firstDate}T00:00:00`).getTime()
      const secondTime = new Date(`${secondDate}T00:00:00`).getTime()
      const firstIsUpcoming = firstTime >= today.getTime()
      const secondIsUpcoming = secondTime >= today.getTime()

      if (firstIsUpcoming !== secondIsUpcoming) return firstIsUpcoming ? -1 : 1
      if (firstTime !== secondTime) return firstIsUpcoming ? firstTime - secondTime : secondTime - firstTime
      return firstEvent.title.localeCompare(secondEvent.title, 'tr-TR')
    })
  }, [events, selectedCoordinatorRoleId])

  if (statusLoading || loadState === 'loading') return <CenteredMessage text="Etkinlikler yükleniyor…" />
  if (!hasActiveMembership) return <CenteredMessage text="Bu sayfaya erişim yetkin yok." />
  if (loadState === 'error') {
    return <CenteredMessage text="Etkinlikler yüklenirken bir hata oluştu. Lütfen daha sonra tekrar dene." />
  }

  const roleLabel = coordinatorRoleName ?? (isSuperAdmin ? 'Süper Yönetici' : 'Koordinatör')

  return (
    <AppShell
      isSuperAdmin={isSuperAdmin}
      displayName={displayName}
      roleLabel={roleLabel}
      onSignOut={() => void handleSignOut()}
    >
      <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
        <div className="grid gap-4 lg:flex lg:items-end lg:justify-between">
          <div className="hidden lg:block">
            <p className="text-sm text-ink-soft">
              Aktif dönem: <span className="font-medium text-brand-dark">{periodLabel ?? 'Belirtilmedi'}</span>
            </p>
            <h1 className="mt-1 text-3xl font-semibold tracking-tight text-ink">Etkinlikler</h1>
            <p className="mt-1 text-sm text-ink-soft">Aktif dönemdeki etkinlikleri buradan görüntüleyebilir ve yönetebilirsiniz.</p>
          </div>

          <button
            type="button"
            onClick={openCreateForm}
            aria-expanded={createState !== 'closed'}
            aria-controls="new-event-mobile-form"
            className="flex min-h-[52px] w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-amber-600 via-accent to-amber-600 px-4 text-base font-semibold text-white shadow-card transition hover:brightness-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 lg:min-h-[44px] lg:w-auto lg:rounded-md lg:bg-accent lg:text-sm"
          >
            <PlusIcon />
            Etkinlik oluştur
          </button>
        </div>

        {isSuperAdmin ? (
          <label className="mt-4 flex min-h-[44px] items-center gap-2 text-sm text-ink-soft">
            <input type="checkbox" checked={showInactive} onChange={(event) => setShowInactive(event.target.checked)} className="h-4 w-4 accent-brand" />
            Pasif etkinlikleri göster
          </label>
        ) : null}

        {successMessage ? (
          <p role="status" className="mt-5 rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
            {successMessage}
          </p>
        ) : null}

        <NewEventPanel
          isOpen={createState !== 'closed'}
          title={title}
          description={description}
          planningDate={planningDate}
          estimatedDate={estimatedDate}
          error={createError}
          submitting={createState === 'submitting'}
          onTitleChange={setTitle}
          onDescriptionChange={setDescription}
          onPlanningDateChange={setPlanningDate}
          onEstimatedDateChange={setEstimatedDate}
          onSubmit={() => void handleCreateEvent()}
          onClose={closeCreateForm}
        />

        {events.length > 0 ? (
          <section className="mt-5 rounded-xl border border-canvas-border bg-canvas-surface p-4 shadow-card sm:p-5">
            <div className="flex items-start gap-3">
              <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-brand-soft text-brand-dark"><FilterIcon /></span>
              <div>
                <h2 className="font-semibold text-ink">Koordinatörlüğe göre filtrele</h2>
                <p className="mt-0.5 text-xs text-ink-soft sm:text-sm">Yalnızca etkinliği bulunan ekipler gösterilir.</p>
              </div>
            </div>

            <div className="-mx-4 mt-4 flex snap-x gap-2 overflow-x-auto px-4 pb-1 sm:-mx-5 sm:px-5 lg:mx-0 lg:flex lg:flex-wrap lg:gap-4 lg:overflow-visible lg:px-0" role="radiogroup" aria-label="Etkinlikleri koordinatörlüğe göre filtrele">
              <button
                type="button"
                role="radio"
                aria-checked={selectedCoordinatorRoleId === 'all'}
                onClick={() => setSelectedCoordinatorRoleId('all')}
                className={`flex min-h-[52px] w-auto min-w-max snap-start items-center gap-2 rounded-xl border px-4 text-sm font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 lg:min-h-[52px] lg:w-60 ${selectedCoordinatorRoleId === 'all' ? 'border-brand bg-brand-soft text-brand-dark' : 'border-canvas-border bg-canvas-surface text-ink hover:border-brand/40'}`}
              >
                <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full ${selectedCoordinatorRoleId === 'all' ? 'bg-brand-dark text-white' : 'bg-canvas text-ink-soft'}`}>{selectedCoordinatorRoleId === 'all' ? <CheckIcon /> : events.length}</span>
                <span>Tümü</span>
              </button>
              {coordinatorRoleOptions.map((role) => {
                const presentation = coordinatorRolePresentation(role.slug, role.name)
                const isSelected = selectedCoordinatorRoleId === role.id
                return (
                  <button
                    key={role.id}
                    type="button"
                    role="radio"
                    aria-checked={isSelected}
                    title={role.name}
                    onClick={() => setSelectedCoordinatorRoleId(role.id)}
                    className={`flex min-h-[52px] w-auto min-w-max snap-start items-center gap-2 rounded-xl border px-4 text-left text-sm font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 lg:min-h-[52px] lg:w-60 lg:min-w-0 ${isSelected ? presentation.selectedClass : presentation.softClass}`}
                  >
                    <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-semibold ${isSelected ? `${presentation.dotClass} text-white` : 'bg-white/80'}`}>{isSelected ? <CheckIcon /> : role.count}</span>
                    <span className="whitespace-nowrap lg:whitespace-normal">{presentation.shortLabel}</span>
                  </button>
                )
              })}
            </div>
          </section>
        ) : null}

        {events.length === 0 ? (
          <div className="mt-6 rounded-xl border border-canvas-border bg-canvas-surface px-4 py-8 text-center shadow-card">
            <span className="mx-auto flex h-11 w-11 items-center justify-center rounded-full bg-brand-soft text-brand-dark"><CalendarIcon /></span>
            <p className="mt-3 text-sm font-medium text-ink">Bu dönemde henüz etkinlik oluşturulmamış.</p>
            <p className="mt-1 text-xs text-ink-soft">İlk etkinliği oluşturmak için yukarıdaki düğmeyi kullanabilirsin.</p>
          </div>
        ) : (
          filteredEvents.length === 0 ? (
            <div className="mt-6 rounded-xl border border-canvas-border bg-canvas-surface px-4 py-8 text-center shadow-card"><p className="text-sm font-medium text-ink">Bu koordinatörlüğe ait etkinlik bulunmuyor.</p><button type="button" onClick={() => setSelectedCoordinatorRoleId('all')} className="mt-3 min-h-[44px] rounded-md px-3 text-sm font-medium text-brand-dark">Tüm etkinlikleri göster</button></div>
          ) : <>
          <ul className="mt-5 grid grid-cols-2 gap-2.5 lg:hidden">
            {filteredEvents.map((event) => {
              const ownerRolePresentation = coordinatorRolePresentation(event.ownerRoleSlug, event.ownerRoleName ?? '')
              const displayDate = eventDisplayDate(event)

              return (
                <li key={event.id} className={`relative flex min-h-[168px] flex-col rounded-xl border shadow-card ${event.deletedAt ? 'border-red-200 bg-red-50/40' : 'border-canvas-border bg-canvas-surface'}`}>
                  <div className="flex flex-1 flex-col overflow-hidden rounded-xl p-3">
                    <div className="flex flex-wrap gap-1.5 text-[11px] leading-4">
                      <span className={`rounded-full px-2 py-1 font-medium ${statusClass(event.eventStatusSlug)}`}>{event.eventStatus}</span>
                      {event.ownerRoleName ? (
                        <span className={`max-w-full truncate rounded-full border px-2 py-1 font-semibold ${ownerRolePresentation.softClass}`} title={event.ownerRoleName}>
                          {ownerRolePresentation.shortLabel}
                        </span>
                      ) : null}
                      {event.deletedAt ? <span className="rounded-full border border-red-200 bg-red-50 px-2 py-1 font-medium text-red-700">Pasif</span> : null}
                    </div>

                    <p className="mt-3 truncate text-xs text-ink-soft" title={`Sorumlu: ${event.ownerName}`}>Sorumlu: {event.ownerName}</p>

                    {event.deletedAt ? (
                      <div className="flex flex-1 flex-col">
                        <h2 className="mt-3 line-clamp-2 break-words text-base font-semibold leading-5 text-ink">{event.title}</h2>
                        <div className={`mt-auto flex items-center gap-2 border-t border-canvas-border pt-2 text-xs text-ink-soft ${isSuperAdmin ? 'pr-9' : ''}`}>
                          <span className="shrink-0 text-brand-dark"><CalendarIcon /></span>
                          <span>{formatDate(displayDate)}</span>
                        </div>
                      </div>
                    ) : (
                      <Link to={`/app/etkinlikler/${event.id}`} aria-label={`${event.title} etkinliğini aç`} className="flex flex-1 flex-col rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand">
                        <h2 className="mt-3 line-clamp-2 break-words text-base font-semibold leading-5 text-ink">{event.title}</h2>
                        <div className={`mt-auto flex items-center gap-2 border-t border-canvas-border pt-2 text-xs text-ink-soft ${isSuperAdmin ? 'pr-9' : ''}`}>
                          <span className="shrink-0 text-brand-dark"><CalendarIcon /></span>
                          <span>{formatDate(displayDate)}</span>
                        </div>
                      </Link>
                    )}
                  </div>

                  {isSuperAdmin ? (
                    <>
                      <button
                        type="button"
                        aria-label={`${event.title} için yönetim işlemlerini göster`}
                        aria-expanded={mobileActionEventId === event.id}
                        onClick={() => setMobileActionEventId((currentId) => currentId === event.id ? null : event.id)}
                        className="absolute bottom-0.5 right-0.5 z-10 flex h-11 w-11 items-center justify-center rounded-full text-ink-soft hover:bg-canvas focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
                      >
                        <MoreIcon />
                      </button>
                      {mobileActionEventId === event.id ? (
                        <div className="absolute bottom-11 right-2 z-20 grid w-40 overflow-hidden rounded-lg border border-canvas-border bg-canvas-surface shadow-xl">
                          <button type="button" onClick={() => { setMobileActionEventId(null); void toggleEventActive(event) }} disabled={updatingEventId === event.id} className={`min-h-[44px] px-3 text-left text-xs font-medium disabled:opacity-50 ${event.deletedAt ? 'text-brand-dark' : 'text-danger'}`}>{updatingEventId === event.id ? 'İşleniyor…' : event.deletedAt ? 'Yeniden aktifleştir' : 'Pasifleştir'}</button>
                          {event.deletedAt ? <button type="button" onClick={() => { setMobileActionEventId(null); setSuccessMessage(null); setDeleteError(null); setDeleteTarget(event) }} className="min-h-[44px] border-t border-canvas-border px-3 text-left text-xs font-medium text-danger">Kalıcı sil</button> : null}
                        </div>
                      ) : null}
                    </>
                  ) : null}
                </li>
              )
            })}
          </ul>

          <ul className="mt-6 hidden grid-cols-3 gap-4 lg:grid">
            {filteredEvents.map((event) => {
              const ownerRolePresentation = coordinatorRolePresentation(event.ownerRoleSlug, event.ownerRoleName ?? '')
              const displayDate = eventDisplayDate(event)

              return (
                <li key={event.id} className={`flex min-h-[176px] flex-col overflow-hidden rounded-xl border shadow-card ${event.deletedAt ? 'border-red-200 bg-red-50/40' : 'border-canvas-border bg-canvas-surface'}`}>
                  {event.deletedAt ? (
                    <div className="flex flex-1 flex-col p-4">
                      <div className="flex flex-wrap items-center gap-2 text-xs">
                        <span className={`rounded-full px-2.5 py-1 font-medium ${statusClass(event.eventStatusSlug)}`}>{event.eventStatus}</span>
                        {event.ownerRoleName ? <span className={`inline-flex max-w-full items-center gap-1.5 truncate rounded-full border px-2.5 py-1 font-semibold ${ownerRolePresentation.softClass}`} title={event.ownerRoleName}><span className={`h-2 w-2 shrink-0 rounded-full ${ownerRolePresentation.dotClass}`} />{ownerRolePresentation.shortLabel}</span> : null}
                        <span className="rounded-full border border-red-200 bg-red-50 px-2.5 py-1 font-medium text-red-700">Pasif</span>
                      </div>
                      <p className="mt-3 truncate text-sm text-ink-soft" title={`Sorumlu: ${event.ownerName}`}>Sorumlu: {event.ownerName}</p>
                      <h2 className="mt-3 line-clamp-2 break-words text-lg font-semibold leading-6 text-ink">{event.title}</h2>
                    </div>
                  ) : (
                    <Link to={`/app/etkinlikler/${event.id}`} aria-label={`${event.title} etkinliğini aç`} className="flex flex-1 flex-col p-4 transition hover:bg-canvas/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-brand">
                      <div className="flex flex-wrap items-center gap-2 text-xs">
                        <span className={`rounded-full px-2.5 py-1 font-medium ${statusClass(event.eventStatusSlug)}`}>{event.eventStatus}</span>
                        {event.ownerRoleName ? <span className={`inline-flex max-w-full items-center gap-1.5 truncate rounded-full border px-2.5 py-1 font-semibold ${ownerRolePresentation.softClass}`} title={event.ownerRoleName}><span className={`h-2 w-2 shrink-0 rounded-full ${ownerRolePresentation.dotClass}`} />{ownerRolePresentation.shortLabel}</span> : null}
                      </div>
                      <p className="mt-3 truncate text-sm text-ink-soft" title={`Sorumlu: ${event.ownerName}`}>Sorumlu: {event.ownerName}</p>
                      <h2 className="mt-3 line-clamp-2 break-words text-lg font-semibold leading-6 text-ink">{event.title}</h2>
                    </Link>
                  )}

                  <div className="flex min-h-[48px] items-center justify-between gap-2 border-t border-canvas-border px-4 py-2 text-sm text-ink-soft">
                    <span className="flex min-w-0 items-center gap-2"><span className="shrink-0 text-brand-dark"><CalendarIcon /></span><span className="truncate">{formatDate(displayDate)}</span></span>
                    {isSuperAdmin ? (
                      <span className="flex shrink-0 items-center gap-1">
                        <button type="button" onClick={() => void toggleEventActive(event)} disabled={updatingEventId === event.id} className={`min-h-[36px] rounded-md px-2 text-xs font-medium disabled:opacity-50 ${event.deletedAt ? 'text-brand-dark hover:bg-brand-soft' : 'text-danger hover:bg-danger-soft'}`}>{updatingEventId === event.id ? 'İşleniyor…' : event.deletedAt ? 'Aktifleştir' : 'Pasifleştir'}</button>
                        {event.deletedAt ? <button type="button" onClick={() => { setSuccessMessage(null); setDeleteError(null); setDeleteTarget(event) }} className="min-h-[36px] rounded-md px-2 text-xs font-medium text-danger hover:bg-danger-soft focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-danger">Kalıcı sil</button> : null}
                      </span>
                    ) : null}
                  </div>
                </li>
              )
            })}
          </ul>
          </>
        )}
      </main>

      <PermanentDeleteDialog
        isOpen={deleteTarget !== null}
        title="Etkinliği kalıcı olarak sil"
        itemName={deleteTarget?.title ?? ''}
        description="Etkinlik; bağlı görevleri, bildirimleri, kararları, raporları, bağlantıları, dosya kayıtları, SKS, bütçe ve sponsor bilgileriyle birlikte silinecek."
        isDeleting={isDeleting}
        error={deleteError}
        onClose={closeDeleteDialog}
        onConfirm={() => void handlePermanentDelete()}
      />

    </AppShell>
  )
}
