import type { Session } from '@supabase/supabase-js'
import { Link } from 'react-router-dom'
import AppShell from '../components/AppShell'
import { useMembershipStatus } from '../hooks/useMembershipStatus'
import { supabase } from '../lib/supabaseClient'

const calendars = [
  { title: 'Etkinlik Takvimi', description: 'Etkinlik tarihleri, hazırlık başlangıçları ve yetkili görev son tarihleri.', to: '/app/takvimler/etkinlik', tone: 'border-brand/20 bg-brand-soft text-brand-dark' },
  { title: 'Farkındalık Takvimi', description: 'Farkındalık dönemleri, paylaşım tarihleri ve ilgili görevler.', to: '/app/takvimler/farkindalik', tone: 'border-accent/30 bg-accent-soft text-amber-900' },
  { title: 'PR Takvimi', description: 'Basın ve yayın planını ayrı bir çalışma görünümünde takip edin.', to: '/app/takvimler/pr', tone: 'border-purple-200 bg-purple-50 text-purple-800' },
]

function CalendarIcon() {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" className="h-6 w-6" aria-hidden="true"><rect x="3.5" y="4.5" width="17" height="16" rx="2" /><path d="M3.5 9.5h17M8 3v3M16 3v3" /></svg>
}

export default function CalendarHub({ session }: { session: Session }) {
  const { displayName, appRole, coordinatorRoleName } = useMembershipStatus(session)
  const isSuperAdmin = appRole === 'super_admin'
  const roleLabel = coordinatorRoleName ?? (isSuperAdmin ? 'Süper Yönetici' : 'Koordinatör')

  return (
    <AppShell isSuperAdmin={isSuperAdmin} displayName={displayName} roleLabel={roleLabel} onSignOut={() => void supabase.auth.signOut()}>
      <main className="mx-auto max-w-6xl px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
        <p className="text-sm text-ink-soft">Planlama merkezi</p>
        <h1 className="mt-1 text-3xl font-semibold tracking-tight text-ink">Takvimler</h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-ink-soft">Çalışma alanına göre ayrılmış takvimlerden doğru kayda ve yalnızca erişebildiğiniz görev tarihine gidin.</p>
        <section className="mt-6 grid gap-4 md:grid-cols-3" aria-label="Takvim seçenekleri">
          {calendars.map((calendar) => (
            <Link key={calendar.to} to={calendar.to} className="group rounded-2xl border border-canvas-border bg-canvas-surface p-5 shadow-card transition hover:-translate-y-0.5 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2">
              <span className={`flex h-12 w-12 items-center justify-center rounded-xl border ${calendar.tone}`}><CalendarIcon /></span>
              <h2 className="mt-5 text-lg font-semibold text-ink">{calendar.title}</h2>
              <p className="mt-2 text-sm leading-6 text-ink-soft">{calendar.description}</p>
              <span className="mt-5 inline-flex text-sm font-semibold text-brand-dark group-hover:underline">Takvimi aç</span>
            </Link>
          ))}
        </section>
      </main>
    </AppShell>
  )
}
