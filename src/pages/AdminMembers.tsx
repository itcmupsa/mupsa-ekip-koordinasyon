import { useEffect, useState } from 'react'
import type { Session } from '@supabase/supabase-js'
import { supabase } from '../lib/supabaseClient'
import { useMembershipStatus, type AppRole } from '../hooks/useMembershipStatus'

interface MemberProfileRelation {
  display_name: string
}

interface MemberCoordinatorRoleRelation {
  name: string
}

interface MemberRow {
  id: string
  displayName: string
  coordinatorRoleName: string | null
  appRole: AppRole | null
  isActive: boolean
}

type LoadState = 'loading' | 'ready' | 'error'

function pickOne<T>(value: T | T[] | null | undefined): T | null {
  if (!value) return null
  return Array.isArray(value) ? (value[0] ?? null) : value
}

function CenteredMessage({ text }: { text: string }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-canvas px-4">
      <p className="text-center text-sm text-ink-soft">{text}</p>
    </div>
  )
}

export default function AdminMembers({ session }: { session: Session }) {
  const { hasActiveMembership, appRole, periodId, periodLabel, loading: statusLoading } =
    useMembershipStatus(session)
  const [members, setMembers] = useState<MemberRow[]>([])
  const [loadState, setLoadState] = useState<LoadState>('loading')

  const isSuperAdmin = hasActiveMembership && appRole === 'super_admin'

  useEffect(() => {
    if (statusLoading) return
    if (!isSuperAdmin || !periodId) {
      setLoadState('ready')
      return
    }

    let isMounted = true
    setLoadState('loading')

    async function loadMembers() {
      const { data, error } = await supabase
        .from('period_memberships')
        .select('id, app_role, is_active, profiles!inner(display_name), coordinator_roles(name)')
        .eq('period_id', periodId)

      if (!isMounted) return

      if (error) {
        setLoadState('error')
        return
      }

      const rows: MemberRow[] = (data ?? []).map((row) => {
        const profile = pickOne(
          row.profiles as MemberProfileRelation | MemberProfileRelation[] | null | undefined,
        )
        const coordinatorRole = pickOne(
          row.coordinator_roles as MemberCoordinatorRoleRelation | MemberCoordinatorRoleRelation[] | null | undefined,
        )
        return {
          id: row.id as string,
          displayName: profile?.display_name ?? 'İsimsiz üye',
          coordinatorRoleName: coordinatorRole?.name ?? null,
          appRole: (row.app_role as AppRole | null) ?? null,
          isActive: Boolean(row.is_active),
        }
      })

      setMembers(rows)
      setLoadState('ready')
    }

    loadMembers()
    return () => {
      isMounted = false
    }
  }, [statusLoading, isSuperAdmin, periodId])

  if (statusLoading || loadState === 'loading') {
    return <CenteredMessage text="Yükleniyor…" />
  }

  if (!isSuperAdmin) {
    return <CenteredMessage text="Bu sayfaya erişim yetkin yok." />
  }

  if (loadState === 'error') {
    return <CenteredMessage text="Üyeler yüklenirken bir hata oluştu. Lütfen daha sonra tekrar dene." />
  }

  return (
    <div className="min-h-screen bg-canvas">
      <header className="border-b border-canvas-border bg-canvas-surface">
        <div className="mx-auto max-w-3xl px-4 py-4">
          <span className="text-sm font-semibold text-ink">Ekip ve yetki yönetimi</span>
        </div>
      </header>
      <main className="mx-auto max-w-3xl px-4 py-8">
        <p className="text-sm text-ink-soft">
          {periodLabel ? `Aktif dönem: ${periodLabel}` : 'Aktif dönem'}
        </p>

        {members.length === 0 ? (
          <p className="mt-6 text-sm text-ink-soft">Bu dönemde henüz kayıtlı üye yok.</p>
        ) : (
          <ul className="mt-6 space-y-3">
            {members.map((member) => (
              <li
                key={member.id}
                className="rounded-lg border border-canvas-border bg-canvas-surface p-4 shadow-card"
              >
                <p className="text-sm font-semibold text-ink">{member.displayName}</p>
                <p className="mt-1 text-sm text-ink-soft">
                  {member.coordinatorRoleName ?? 'Koordinatörlük atanmamış'}
                </p>
                <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
                  <span className="rounded-full bg-accent-soft px-2 py-1 font-medium text-ink">
                    {member.appRole === 'super_admin' ? 'Süper Yönetici' : 'Koordinatör'}
                  </span>
                  <span
                    className={
                      member.isActive
                        ? 'rounded-full bg-accent-soft px-2 py-1 font-medium text-ink'
                        : 'rounded-full bg-canvas px-2 py-1 font-medium text-ink-soft'
                    }
                  >
                    {member.isActive ? 'Aktif' : 'Pasif'}
                  </span>
                </div>
              </li>
            ))}
          </ul>
        )}
      </main>
    </div>
  )
}
