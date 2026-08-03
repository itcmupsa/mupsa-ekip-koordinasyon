import { useEffect, useState } from 'react'
import type { Session } from '@supabase/supabase-js'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabaseClient'
import { useMembershipStatus } from '../hooks/useMembershipStatus'

interface EventRow {
  id: string
  title: string
  eventStatus: string
  planningDate: string
  estimatedDate: string | null
  confirmedDate: string | null
  ownerName: string
}

interface ProfileRow {
  id: string
  display_name: string
}

interface StatusRow {
  slug: string
  label: string
}

type LoadState = 'loading' | 'ready' | 'error'

function formatDate(value: string | null) {
  if (!value) return 'Tarih henüz belirlenmedi'
  return new Intl.DateTimeFormat('tr-TR', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  }).format(new Date(`${value}T00:00:00`))
}

function CenteredMessage({ text }: { text: string }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-canvas px-4">
      <p className="text-center text-sm text-ink-soft">{text}</p>
    </div>
  )
}

export default function EventsList({ session }: { session: Session }) {
  const { hasActiveMembership, periodId, periodLabel, loading: statusLoading } =
    useMembershipStatus(session)
  const [events, setEvents] = useState<EventRow[]>([])
  const [loadState, setLoadState] = useState<LoadState>('loading')

  useEffect(() => {
    if (statusLoading) return
    if (!hasActiveMembership || !periodId) {
      setLoadState('ready')
      return
    }

    let isMounted = true
    async function loadEvents() {
      setLoadState('loading')

      const { data: eventData, error: eventError } = await supabase
        .from('events')
        .select('id, title, event_status, planning_date, estimated_date, confirmed_date, owner_id')
        .eq('period_id', periodId)
        .is('deleted_at', null)
        .order('planning_date', { ascending: false })

      if (eventError) {
        if (isMounted) setLoadState('error')
        return
      }

      const eventRows = eventData ?? []
      const ownerIds = [...new Set(eventRows.map((event) => event.owner_id as string))]
      const statusSlugs = [...new Set(eventRows.map((event) => event.event_status as string))]
      const [profilesResult, statusesResult] = await Promise.all([
        ownerIds.length > 0
          ? supabase.from('profiles').select('id, display_name').in('id', ownerIds)
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
        ((profilesResult.data ?? []) as ProfileRow[]).map((profile) => [profile.id, profile.display_name]),
      )
      const statuses = new Map(
        ((statusesResult.data ?? []) as StatusRow[]).map((status) => [status.slug, status.label]),
      )

      setEvents(
        eventRows.map((event) => ({
          id: event.id as string,
          title: event.title as string,
          eventStatus: statuses.get(event.event_status as string) ?? (event.event_status as string),
          planningDate: event.planning_date as string,
          estimatedDate: (event.estimated_date as string | null) ?? null,
          confirmedDate: (event.confirmed_date as string | null) ?? null,
          ownerName: profiles.get(event.owner_id as string) ?? 'Sorumlu belirtilmemiş',
        })),
      )
      setLoadState('ready')
    }

    void loadEvents()
    return () => {
      isMounted = false
    }
  }, [hasActiveMembership, periodId, statusLoading])

  if (statusLoading || loadState === 'loading') return <CenteredMessage text="Etkinlikler yükleniyor…" />
  if (!hasActiveMembership) return <CenteredMessage text="Bu sayfaya erişim yetkin yok." />
  if (loadState === 'error') {
    return <CenteredMessage text="Etkinlikler yüklenirken bir hata oluştu. Lütfen daha sonra tekrar dene." />
  }

  return (
    <div className="min-h-screen bg-canvas">
      <header className="border-b border-canvas-border bg-canvas-surface">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-4 py-4">
          <Link to="/app" className="text-sm font-semibold text-ink">
            MUPSA Ekip Koordinasyon
          </Link>
          <Link to="/app" className="text-sm font-medium text-ink-soft">
            Ana sayfa
          </Link>
        </div>
      </header>
      <main className="mx-auto max-w-3xl px-4 py-8">
        <p className="text-sm text-ink-soft">{periodLabel ? `Aktif dönem: ${periodLabel}` : 'Aktif dönem'}</p>
        <h1 className="mt-1 text-xl font-semibold text-ink">Etkinlikler</h1>

        {events.length === 0 ? (
          <div className="mt-6 rounded-lg border border-canvas-border bg-canvas-surface p-6 shadow-card">
            <p className="text-sm text-ink-soft">Bu dönemde henüz etkinlik oluşturulmamış.</p>
          </div>
        ) : (
          <ul className="mt-6 space-y-3">
            {events.map((event) => (
              <li key={event.id} className="rounded-lg border border-canvas-border bg-canvas-surface p-4 shadow-card">
                <p className="text-base font-semibold text-ink">{event.title}</p>
                <div className="mt-3 flex flex-wrap gap-2 text-xs">
                  <span className="rounded-full bg-accent-soft px-2 py-1 font-medium text-ink">
                    {event.eventStatus}
                  </span>
                  <span className="rounded-full bg-canvas px-2 py-1 font-medium text-ink-soft">
                    Sorumlu: {event.ownerName}
                  </span>
                </div>
                <dl className="mt-4 space-y-1 text-sm text-ink-soft">
                  <div>
                    <dt className="inline font-medium text-ink">Planlama: </dt>
                    <dd className="inline">{formatDate(event.planningDate)}</dd>
                  </div>
                  <div>
                    <dt className="inline font-medium text-ink">Tahmini tarih: </dt>
                    <dd className="inline">{formatDate(event.estimatedDate ?? event.confirmedDate)}</dd>
                  </div>
                </dl>
              </li>
            ))}
          </ul>
        )}
      </main>
    </div>
  )
}
