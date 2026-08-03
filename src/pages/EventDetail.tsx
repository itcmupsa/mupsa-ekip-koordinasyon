import { Link, useParams } from 'react-router-dom'

export default function EventDetail() {
  const { eventId } = useParams<{ eventId: string }>()

  return (
    <div className="min-h-screen bg-canvas">
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
      <main className="mx-auto max-w-3xl px-4 py-8">
        <h1 className="text-xl font-semibold text-ink">Etkinlik detayı</h1>
        <div className="mt-6 rounded-lg border border-canvas-border bg-canvas-surface p-6 shadow-card">
          <p className="text-sm text-ink-soft">Bu ekran hazırlanıyor.</p>
          {eventId && <p className="mt-2 text-xs text-ink-soft">Etkinlik kimliği: {eventId}</p>}
        </div>
      </main>
    </div>
  )
}
