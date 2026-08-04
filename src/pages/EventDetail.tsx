import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useSession } from '../hooks/useSession'
import { useMembershipStatus } from '../hooks/useMembershipStatus'
import { supabase } from '../lib/supabaseClient'

interface EventBasicInfo {
  title: string
  description: string | null
  eventStatus: string | null
  planningDate: string | null
  preparationStartDate: string | null
  estimatedDate: string | null
  confirmedDate: string | null
  ownerId: string | null
  venue: string | null
  nextAction: string | null
}

type LoadState = 'loading' | 'ready' | 'not_found' | 'error'

const NOT_SPECIFIED = 'Henüz belirtilmedi'

function CenteredMessage({ text }: { text: string }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-canvas px-4">
      <p className="text-center text-sm text-ink-soft">{text}</p>
    </div>
  )
}

function formatDate(value: string | null): string {
  if (!value) return 'Tarih henüz belirlenmedi'
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return 'Tarih henüz belirlenmedi'
  return parsed.toLocaleDateString('tr-TR', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-1 py-2 sm:flex-row sm:items-center sm:justify-between">
      <span className="text-sm font-medium text-ink-soft">{label}</span>
      <span className="text-sm text-ink">{value}</span>
    </div>
  )
}

export default function EventDetail() {
  const { eventId } = useParams<{ eventId: string }>()
  const { session } = useSession()
  const { hasActiveMembership, periodId, loading: statusLoading } =
    useMembershipStatus(session)
  const [loadState, setLoadState] = useState<LoadState>('loading')
  const [event, setEvent] = useState<EventBasicInfo | null>(null)
  const [statusLabel, setStatusLabel] = useState<string | null>(null)
  const [ownerName, setOwnerName] = useState<string | null>(null)

  useEffect(() => {
    if (statusLoading) return
    if (!hasActiveMembership || !periodId || !eventId) {
      setLoadState('ready')
      return
    }

    let isMounted = true
    async function loadEvent() {
      setLoadState('loading')

      const { data, error } = await supabase
        .from('events')
        .select(
          'title, description, event_status, planning_date, preparation_start_date, estimated_date, confirmed_date, owner_id, venue, next_action',
        )
        .eq('id', eventId)
        .eq('period_id', periodId)
        .is('deleted_at', null)
        .maybeSingle()

      if (!isMounted) return
      if (error) {
        setLoadState('error')
        return
      }
      if (!data) {
        setLoadState('not_found')
        return
      }

      const eventStatus = (data.event_status as string | null) ?? null
      const ownerId = (data.owner_id as string | null) ?? null
      setEvent({
        title: data.title as string,
        description: (data.description as string | null) ?? null,
        eventStatus,
        planningDate: (data.planning_date as string | null) ?? null,
        preparationStartDate: (data.preparation_start_date as string | null) ?? null,
        estimatedDate: (data.estimated_date as string | null) ?? null,
        confirmedDate: (data.confirmed_date as string | null) ?? null,
        ownerId,
        venue: (data.venue as string | null) ?? null,
        nextAction: (data.next_action as string | null) ?? null,
      })
      setLoadState('ready')

      if (eventStatus) {
        const { data: statusData } = await supabase
          .from('event_statuses')
          .select('label')
          .eq('slug', eventStatus)
          .maybeSingle()

        if (!isMounted) return
        setStatusLabel((statusData?.label as string | null) ?? null)
      } else {
        setStatusLabel(null)
      }

      if (ownerId) {
        const { data: ownerData } = await supabase
          .from('profiles')
          .select('display_name')
          .eq('id', ownerId)
          .maybeSingle()

        if (!isMounted) return
        setOwnerName((ownerData?.display_name as string | null) ?? null)
      } else {
        setOwnerName(null)
      }
    }

    void loadEvent()
    return () => {
      isMounted = false
    }
  }, [hasActiveMembership, periodId, eventId, statusLoading])

  const header = (
    <header className="border-b border-canvas-border bg-canvas-surface">
      <div className="mx-auto flex max-w-3xl items-center justify-between px-4 py-4">
        <Link to="/app" className="text-sm font-semibold text-ink">
          MUPSA Ekip Koordinasyon
        </Link>
        <Link to="/app/etkinlikler" className="text-sm font-medium text-ink-soft">
          Etkinliklere dön
        </Link>
      </div>
    </header>
  )

  if (statusLoading || loadState === 'loading') return <CenteredMessage text="Etkinlik yükleniyor…" />
  if (!hasActiveMembership) return <CenteredMessage text="Bu sayfaya erişim yetkin yok." />
  if (loadState === 'error') return <CenteredMessage text="Etkinlik yüklenirken bir hata oluştu." />
  if (loadState === 'not_found' || !event) return <CenteredMessage text="Etkinlik bulunamadı." />

  const displayedStatus = statusLabel ?? event.eventStatus ?? 'Durum belirtilmemiş'
  const displayedOwner = event.ownerId ? ownerName ?? NOT_SPECIFIED : NOT_SPECIFIED
  const displayedVenue = event.venue || NOT_SPECIFIED
  const displayedNextAction = event.nextAction || NOT_SPECIFIED

  return (
    <div className="min-h-screen bg-canvas">
      {header}
      <main className="mx-auto max-w-3xl px-4 py-8">
        <h1 className="text-xl font-semibold text-ink">{event.title}</h1>
        <div className="mt-6 rounded-lg border border-canvas-border bg-canvas-surface p-6 shadow-card">
          <p className="text-sm text-ink-soft">{event.description || 'Açıklama eklenmemiş'}</p>
        </div>
        <div className="mt-6 rounded-lg border border-canvas-border bg-canvas-surface p-6 shadow-card">
          <h2 className="text-sm font-semibold text-ink">Durum ve tarihler</h2>
          <div className="mt-3 divide-y divide-canvas-border">
            <DetailRow label="Durum" value={displayedStatus} />
            <DetailRow label="Planlama tarihi" value={formatDate(event.planningDate)} />
            <DetailRow label="Hazırlık başlangıç tarihi" value={formatDate(event.preparationStartDate)} />
            <DetailRow label="Tahmini etkinlik tarihi" value={formatDate(event.estimatedDate)} />
            <DetailRow label="Kesinleşmiş tarih" value={formatDate(event.confirmedDate)} />
          </div>
        </div>
        <div className="mt-6 rounded-lg border border-canvas-border bg-canvas-surface p-6 shadow-card">
          <h2 className="text-sm font-semibold text-ink">Süreç bilgileri</h2>
          <div className="mt-3 divide-y divide-canvas-border">
            <DetailRow label="Sorumlu" value={displayedOwner} />
            <DetailRow label="Mekân" value={displayedVenue} />
            <DetailRow label="Sonraki işlem" value={displayedNextAction} />
          </div>
        </div>
      </main>
    </div>
  )
}
