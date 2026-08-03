import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useSession } from '../hooks/useSession'
import { useMembershipStatus } from '../hooks/useMembershipStatus'
import { supabase } from '../lib/supabaseClient'

interface EventBasicInfo {
  title: string
  description: string | null
}

type LoadState = 'loading' | 'ready' | 'not_found' | 'error'

function CenteredMessage({ text }: { text: string }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-canvas px-4">
      <p className="text-center text-sm text-ink-soft">{text}</p>
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
        .select('title, description')
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

      setEvent({
        title: data.title as string,
        description: (data.description as string | null) ?? null,
      })
      setLoadState('ready')
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

  return (
    <div className="min-h-screen bg-canvas">
      {header}
      <main className="mx-auto max-w-3xl px-4 py-8">
        <h1 className="text-xl font-semibold text-ink">{event.title}</h1>
        <div className="mt-6 rounded-lg border border-canvas-border bg-canvas-surface p-6 shadow-card">
          <p className="text-sm text-ink-soft">{event.description || 'Açıklama eklenmemiş'}</p>
        </div>
      </main>
    </div>
  )
}
