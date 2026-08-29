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
    return <section className="rounded-xl border border-canvas-border bg-canvas-surface p-4 shadow-card"><p className="text-sm text-ink-soft">Koordinatörler yükleniyor…</p></section>
  }

  return (
    <section id="event-coordinators" className="scroll-mt-28 rounded-xl border border-canvas-border bg-canvas-surface p-4 shadow-card sm:p-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="text-base font-semibold text-ink">Etkinlik koordinatörleri</h2>
          <p className="mt-1 text-xs text-ink-soft">Ana koordinatör etkinliğin sahibi; ortak koordinatörler genel yönetimi paylaşır.</p>
        </div>
        <span className="inline-flex w-fit rounded-full bg-canvas px-2.5 py-1 text-xs font-semibold text-ink-soft">{coordinatorMembers.length} ortak</span>
      </div>

      <div className="mt-4 rounded-lg border border-canvas-border bg-canvas px-3 py-3 sm:px-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="min-w-0">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-brand-dark">Ana koordinatör</p>
            <div className="mt-1 flex flex-wrap items-baseline gap-x-2 gap-y-1">
              <p className="text-sm font-semibold text-ink">{owner?.displayName ?? 'Belirtilmedi'}</p>
              <span className="text-xs text-ink-soft">{owner?.roleName ?? 'Koordinatör'}</span>
            </div>
          </div>

          <div className="min-w-0 flex-1 lg:max-w-[65%]">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-ink-soft">Ortak koordinatörler</p>
            {coordinatorMembers.length === 0 ? (
              <p className="mt-1 text-sm text-ink-soft">Ortak koordinatör yok.</p>
            ) : (
              <div className="mt-2 flex flex-wrap gap-2">
                {coordinatorMembers.map(({ coordinator, member }) => (
                  <div key={coordinator.id} className="inline-flex max-w-full items-center gap-2 rounded-full border border-canvas-border bg-canvas-surface py-1.5 pl-3 pr-1.5">
                    <span className="min-w-0 truncate text-xs font-semibold text-ink">{member.displayName}</span>
                    <span className="hidden text-[11px] text-ink-soft md:inline">{member.roleName ?? 'Koordinatör'}</span>
                    {canManage ? (
                      <button
                        type="button"
                        onClick={() => void removeCoordinator(coordinator.id)}
                        disabled={removingId === coordinator.id}
                        aria-label={`${member.displayName} ortak koordinatörünü kaldır`}
                        className="inline-flex h-7 min-w-7 items-center justify-center rounded-full px-2 text-[11px] font-semibold text-danger hover:bg-danger-soft disabled:opacity-50"
                      >
                        {removingId === coordinator.id ? '…' : 'Kaldır'}
                      </button>
                    ) : null}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {canManage && availableMembers.length > 0 ? (
        <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-center">
          <label className="sr-only" htmlFor="event-shared-coordinator-select">Ortak koordinatör seç</label>
          <select id="event-shared-coordinator-select" value={selectedProfileId} onChange={(event) => setSelectedProfileId(event.target.value)} disabled={saving} className="min-h-10 flex-1 rounded-lg border border-canvas-border bg-canvas px-3 text-sm font-medium text-ink">
            <option value="">Ortak koordinatör ekle…</option>
            {availableMembers.map((member) => <option key={member.profileId} value={member.profileId}>{member.roleName ?? 'Koordinatör'} — {member.displayName}</option>)}
          </select>
          <button type="button" onClick={() => void addCoordinator()} disabled={saving || !selectedProfileId} className="min-h-10 rounded-lg bg-brand-dark px-4 text-sm font-semibold text-white disabled:opacity-50">{saving ? 'Ekleniyor…' : 'Ekle'}</button>
        </div>
      ) : null}

      {error ? <p role="alert" className="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p> : null}
    </section>
  )
}
