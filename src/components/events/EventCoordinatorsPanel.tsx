import { useCallback, useEffect, useMemo, useState } from 'react'
import { supabase } from '../../lib/supabaseClient'

interface PeriodMemberRow {
  profile_id: string
  period_display_name: string
  app_role: string
  coordinator_roles: { name: string } | Array<{ name: string }> | null
}

interface CoordinatorRow {
  id: string
  profile_id: string
}

interface MemberOption {
  profileId: string
  displayName: string
  roleName: string | null
  appRole: string
}

function pickRoleName(value: PeriodMemberRow['coordinator_roles']) {
  if (!value) return null
  return Array.isArray(value) ? value[0]?.name ?? null : value.name
}

export default function EventCoordinatorsPanel({ eventId }: { eventId: string }) {
  const [ownerId, setOwnerId] = useState<string | null>(null)
  const [currentProfileId, setCurrentProfileId] = useState<string | null>(null)
  const [members, setMembers] = useState<MemberOption[]>([])
  const [coordinators, setCoordinators] = useState<CoordinatorRow[]>([])
  const [selectedProfileId, setSelectedProfileId] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [removingId, setRemovingId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    if (!eventId) return
    setLoading(true)
    setError(null)

    const { data: authData } = await supabase.auth.getUser()
    const profileId = authData.user?.id ?? null
    setCurrentProfileId(profileId)

    const { data: eventRow, error: eventError } = await supabase
      .from('events')
      .select('owner_id, period_id')
      .eq('id', eventId)
      .maybeSingle()

    if (eventError || !eventRow) {
      setLoading(false)
      setError('Koordinatör bilgileri yüklenemedi.')
      return
    }

    const [membersResult, coordinatorsResult] = await Promise.all([
      supabase
        .from('period_memberships')
        .select('profile_id, period_display_name, app_role, coordinator_roles(name)')
        .eq('period_id', eventRow.period_id as string)
        .eq('is_active', true),
      supabase
        .from('event_coordinators')
        .select('id, profile_id')
        .eq('event_id', eventId)
        .order('created_at', { ascending: true }),
    ])

    if (membersResult.error || coordinatorsResult.error) {
      setLoading(false)
      setError('Koordinatör bilgileri yüklenemedi.')
      return
    }

    setOwnerId(eventRow.owner_id as string)
    setMembers(
      ((membersResult.data ?? []) as PeriodMemberRow[]).map((member) => ({
        profileId: member.profile_id,
        displayName: member.period_display_name,
        roleName: pickRoleName(member.coordinator_roles),
        appRole: member.app_role,
      })),
    )
    setCoordinators((coordinatorsResult.data ?? []) as CoordinatorRow[])
    setLoading(false)
  }, [eventId])

  useEffect(() => {
    void load()
  }, [load])

  const owner = members.find((member) => member.profileId === ownerId) ?? null
  const currentMember = members.find((member) => member.profileId === currentProfileId) ?? null
  const canManage = Boolean(currentProfileId && (currentProfileId === ownerId || currentMember?.appRole === 'super_admin'))
  const coordinatorMembers = coordinators
    .map((coordinator) => ({ coordinator, member: members.find((member) => member.profileId === coordinator.profile_id) }))
    .filter((entry): entry is { coordinator: CoordinatorRow; member: MemberOption } => Boolean(entry.member))

  const availableMembers = useMemo(() => {
    const assigned = new Set(coordinators.map((coordinator) => coordinator.profile_id))
    return members
      .filter((member) => member.profileId !== ownerId && !assigned.has(member.profileId))
      .sort((a, b) => a.displayName.localeCompare(b.displayName, 'tr-TR'))
  }, [coordinators, members, ownerId])

  async function addCoordinator() {
    if (!selectedProfileId || !currentProfileId) return
    setSaving(true)
    setError(null)
    const { error: insertError } = await supabase.from('event_coordinators').insert({
      event_id: eventId,
      profile_id: selectedProfileId,
      added_by: currentProfileId,
    })
    setSaving(false)
    if (insertError) {
      setError('Ortak koordinatör eklenemedi.')
      return
    }
    setSelectedProfileId('')
    await load()
  }

  async function removeCoordinator(coordinatorId: string) {
    setRemovingId(coordinatorId)
    setError(null)
    const { error: deleteError } = await supabase.from('event_coordinators').delete().eq('id', coordinatorId)
    setRemovingId(null)
    if (deleteError) {
      setError('Ortak koordinatör kaldırılamadı.')
      return
    }
    await load()
  }

  if (loading) {
    return <section className="order-1 rounded-xl border border-canvas-border bg-canvas-surface p-4 shadow-card sm:p-5"><p className="text-sm text-ink-soft">Koordinatörler yükleniyor…</p></section>
  }

  return (
    <section id="event-coordinators" className="order-1 scroll-mt-28 rounded-xl border border-canvas-border bg-canvas-surface p-4 shadow-card sm:p-5">
      <div>
        <h2 className="text-base font-semibold text-ink">Etkinlik koordinatörleri</h2>
        <p className="mt-1 text-xs text-ink-soft">Ana koordinatör etkinliğin sahibi olarak kalır. Ortak koordinatörler etkinliğin genel alanlarını ve görevlerini birlikte yönetebilir.</p>
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <div className="rounded-xl border border-brand/20 bg-brand-soft/35 p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-brand-dark">Ana koordinatör</p>
          <p className="mt-2 text-xs font-semibold uppercase tracking-wide text-brand-dark">{owner?.roleName ?? 'Koordinatör'}</p>
          <p className="mt-1 text-sm font-semibold text-ink">{owner?.displayName ?? 'Belirtilmedi'}</p>
        </div>
        <div className="rounded-xl border border-canvas-border bg-canvas p-4">
          <div className="flex items-center justify-between gap-2"><p className="text-xs font-semibold uppercase tracking-wide text-ink-soft">Ortak koordinatörler</p><span className="rounded-full bg-canvas-surface px-2 py-0.5 text-xs font-semibold text-ink-soft">{coordinatorMembers.length}</span></div>
          {coordinatorMembers.length === 0 ? <p className="mt-3 text-sm text-ink-soft">Bu etkinlik henüz ortak değil.</p> : (
            <div className="mt-3 grid gap-2">
              {coordinatorMembers.map(({ coordinator, member }) => (
                <div key={coordinator.id} className="flex items-center justify-between gap-3 rounded-lg border border-canvas-border bg-canvas-surface px-3 py-2">
                  <div className="min-w-0"><p className="truncate text-xs font-semibold uppercase tracking-wide text-brand-dark">{member.roleName ?? 'Koordinatör'}</p><p className="mt-0.5 truncate text-sm font-semibold text-ink">{member.displayName}</p></div>
                  {canManage ? <button type="button" onClick={() => void removeCoordinator(coordinator.id)} disabled={removingId === coordinator.id} className="min-h-10 shrink-0 rounded-md px-3 text-xs font-semibold text-danger hover:bg-danger-soft disabled:opacity-50">{removingId === coordinator.id ? 'Kaldırılıyor…' : 'Kaldır'}</button> : null}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {canManage && availableMembers.length > 0 ? (
        <div className="mt-4 flex flex-col gap-3 rounded-xl border border-canvas-border bg-canvas p-4 sm:flex-row sm:items-end">
          <label className="grid flex-1 gap-1.5 text-xs font-semibold uppercase tracking-wide text-ink-soft">Ortak koordinatör ekle<select value={selectedProfileId} onChange={(event) => setSelectedProfileId(event.target.value)} disabled={saving} className="min-h-11 rounded-lg border border-canvas-border bg-canvas-surface px-3 text-sm font-medium normal-case tracking-normal text-ink"><option value="">Koordinatörlük ve kişi seçin</option>{availableMembers.map((member) => <option key={member.profileId} value={member.profileId}>{member.roleName ?? 'Koordinatör'} — {member.displayName}</option>)}</select></label>
          <button type="button" onClick={() => void addCoordinator()} disabled={saving || !selectedProfileId} className="min-h-11 rounded-lg bg-brand-dark px-4 text-sm font-semibold text-white disabled:opacity-50">{saving ? 'Ekleniyor…' : 'Ekle'}</button>
        </div>
      ) : null}

      {error ? <p role="alert" className="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p> : null}
    </section>
  )
}
