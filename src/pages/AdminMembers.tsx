import { useCallback, useEffect, useState } from 'react'
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
  profileId: string
  displayName: string
  coordinatorRoleId: string | null
  coordinatorRoleName: string | null
  appRole: AppRole | null
  isActive: boolean
}

interface InvitableProfile {
  id: string
  displayName: string
}

interface CoordinatorRoleOption {
  id: string
  name: string
}

type LoadState = 'loading' | 'ready' | 'error'
type AddPanelState = 'idle' | 'loading' | 'ready' | 'error'
type EditPanelState = 'idle' | 'loading' | 'ready' | 'error'

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

  // Add-member panel state
  const [isAddOpen, setIsAddOpen] = useState(false)
  const [addPanelState, setAddPanelState] = useState<AddPanelState>('idle')
  const [invitableProfiles, setInvitableProfiles] = useState<InvitableProfile[]>([])
  const [coordinatorRoleOptions, setCoordinatorRoleOptions] = useState<CoordinatorRoleOption[]>([])
  const [selectedProfileId, setSelectedProfileId] = useState('')
  const [selectedCoordinatorRoleId, setSelectedCoordinatorRoleId] = useState('')
  const [selectedAppRole, setSelectedAppRole] = useState<AppRole | ''>('')
  const [formError, setFormError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)

  // Edit-member panel state
  const [editingMemberId, setEditingMemberId] = useState<string | null>(null)
  const [editPanelState, setEditPanelState] = useState<EditPanelState>('idle')
  const [editCoordinatorRoleId, setEditCoordinatorRoleId] = useState('')
  const [editAppRole, setEditAppRole] = useState<AppRole | ''>('')
  const [editIsActive, setEditIsActive] = useState(true)
  const [editError, setEditError] = useState<string | null>(null)
  const [isEditSubmitting, setIsEditSubmitting] = useState(false)

  const isSuperAdmin = hasActiveMembership && appRole === 'super_admin'
  const currentUserId = session.user.id

  const loadMembers = useCallback(async () => {
    if (!periodId) return

    setLoadState('loading')
    const { data, error } = await supabase
      .from('period_memberships')
      .select('id, profile_id, coordinator_role_id, app_role, is_active, profiles!inner(display_name), coordinator_roles(name)')
      .eq('period_id', periodId)

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
        profileId: row.profile_id as string,
        displayName: profile?.display_name ?? 'İsimsiz üye',
        coordinatorRoleId: (row.coordinator_role_id as string | null) ?? null,
        coordinatorRoleName: coordinatorRole?.name ?? null,
        appRole: (row.app_role as AppRole | null) ?? null,
        isActive: Boolean(row.is_active),
      }
    })

    setMembers(rows)
    setLoadState('ready')
  }, [periodId])

  useEffect(() => {
    if (statusLoading) return
    if (!isSuperAdmin || !periodId) {
      setLoadState('ready')
      return
    }

    let isMounted = true
    async function run() {
      await loadMembers()
      if (!isMounted) return
    }
    run()
    return () => {
      isMounted = false
    }
  }, [statusLoading, isSuperAdmin, periodId, loadMembers])

  const resetAddForm = useCallback(() => {
    setSelectedProfileId('')
    setSelectedCoordinatorRoleId('')
    setSelectedAppRole('')
    setFormError(null)
  }, [])

  const ensureCoordinatorRoleOptions = useCallback(async () => {
    if (coordinatorRoleOptions.length > 0) return coordinatorRoleOptions

    const { data, error } = await supabase
      .from('coordinator_roles')
      .select('id, name')
      .eq('is_active', true)
      .order('name')

    if (error) return null

    const options = (data ?? []).map((row) => ({ id: row.id as string, name: row.name as string }))
    setCoordinatorRoleOptions(options)
    return options
  }, [coordinatorRoleOptions])

  const loadInvitableData = useCallback(async () => {
    if (!periodId) return

    setAddPanelState('loading')
    const [existingResult, profilesResult, rolesOptions] = await Promise.all([
      supabase.from('period_memberships').select('profile_id').eq('period_id', periodId),
      supabase.from('profiles').select('id, display_name').order('display_name'),
      ensureCoordinatorRoleOptions(),
    ])

    if (existingResult.error || profilesResult.error || rolesOptions === null) {
      setAddPanelState('error')
      return
    }

    const existingProfileIds = new Set((existingResult.data ?? []).map((row) => row.profile_id as string))
    setInvitableProfiles(
      (profilesResult.data ?? [])
        .filter((row) => !existingProfileIds.has(row.id as string))
        .map((row) => ({ id: row.id as string, displayName: (row.display_name as string) || 'İsimsiz kullanıcı' })),
    )
    setAddPanelState('ready')
  }, [periodId, ensureCoordinatorRoleOptions])

  function handleOpenAddPanel() {
    setSuccessMessage(null)
    setEditingMemberId(null)
    resetAddForm()
    setIsAddOpen(true)
    void loadInvitableData()
  }

  function handleCloseAddPanel() {
    setIsAddOpen(false)
    resetAddForm()
    setAddPanelState('idle')
  }

  async function handleAddMember() {
    setFormError(null)
    if (!periodId || !selectedProfileId || !selectedCoordinatorRoleId || !selectedAppRole) {
      setFormError('Kullanıcı, koordinatörlük ve uygulama rolü seçilmelidir.')
      return
    }

    setIsSubmitting(true)
    const { error } = await supabase.from('period_memberships').insert({
      period_id: periodId,
      profile_id: selectedProfileId,
      coordinator_role_id: selectedCoordinatorRoleId,
      app_role: selectedAppRole,
      is_active: true,
    })
    setIsSubmitting(false)

    if (error) {
      setFormError('Üye eklenirken bir hata oluştu. Lütfen tekrar dene.')
      return
    }

    handleCloseAddPanel()
    setSuccessMessage('Üye başarıyla döneme eklendi.')
    await loadMembers()
  }

  const activeSuperAdminCount = members.filter(
    (member) => member.appRole === 'super_admin' && member.isActive,
  ).length

  function getEditValidationError(
    member: MemberRow,
    nextAppRole: AppRole,
    nextIsActive: boolean,
  ): string | null {
    const isSelf = member.profileId === currentUserId
    const wasActiveSuperAdmin = member.appRole === 'super_admin' && member.isActive
    const isLastActiveSuperAdmin = wasActiveSuperAdmin && activeSuperAdminCount <= 1

    if (isSelf && !nextIsActive) return 'Kendi üyeliğini pasifleştiremezsin.'
    if (isSelf && member.appRole === 'super_admin' && nextAppRole !== 'super_admin') {
      return 'Kendi Süper Yönetici rolünü kaldıramazsın.'
    }
    if (isLastActiveSuperAdmin && !nextIsActive) {
      return 'Sistemdeki son aktif Süper Yönetici pasifleştirilemez.'
    }
    if (isLastActiveSuperAdmin && nextAppRole !== 'super_admin') {
      return 'Sistemdeki son aktif Süper Yönetici Koordinatör rolüne düşürülemez.'
    }
    return null
  }

  function handleOpenEditPanel(member: MemberRow) {
    setSuccessMessage(null)
    setIsAddOpen(false)
    setEditingMemberId(member.id)
    setEditCoordinatorRoleId(member.coordinatorRoleId ?? '')
    setEditAppRole(member.appRole ?? '')
    setEditIsActive(member.isActive)
    setEditError(null)
    setEditPanelState('loading')
    void ensureCoordinatorRoleOptions().then((options) => {
      setEditPanelState(options === null ? 'error' : 'ready')
    })
  }

  function handleCloseEditPanel() {
    setEditingMemberId(null)
    setEditError(null)
    setEditPanelState('idle')
  }

  async function handleSaveEdit(member: MemberRow) {
    setEditError(null)
    if (!editCoordinatorRoleId || !editAppRole) {
      setEditError('Koordinatörlük ve uygulama rolü seçilmelidir.')
      return
    }

    const validationError = getEditValidationError(member, editAppRole, editIsActive)
    if (validationError) {
      setEditError(validationError)
      return
    }

    setIsEditSubmitting(true)
    const { error } = await supabase
      .from('period_memberships')
      .update({
        coordinator_role_id: editCoordinatorRoleId,
        app_role: editAppRole,
        is_active: editIsActive,
      })
      .eq('id', member.id)
    setIsEditSubmitting(false)

    if (error) {
      setEditError('Üye güncellenirken bir hata oluştu. Bu işlem için yetkin olmayabilir.')
      return
    }

    handleCloseEditPanel()
    setSuccessMessage('Üye bilgileri başarıyla güncellendi.')
    await loadMembers()
  }

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
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-ink-soft">
            {periodLabel ? `Aktif dönem: ${periodLabel}` : 'Aktif dönem'}
          </p>
          {!isAddOpen && (
            <button
              type="button"
              onClick={handleOpenAddPanel}
              className="rounded-lg bg-accent-soft px-3 py-2 text-sm font-medium text-ink"
            >
              Üye ekle
            </button>
          )}
        </div>

        {successMessage && (
          <p className="mt-4 rounded-lg border border-canvas-border bg-accent-soft px-3 py-2 text-sm text-ink">
            {successMessage}
          </p>
        )}

        {isAddOpen && (
          <div className="mt-4 rounded-lg border border-canvas-border bg-canvas-surface p-4 shadow-card">
            <div className="flex items-center justify-between">
              <p className="text-sm font-semibold text-ink">Döneme üye ekle</p>
              <button
                type="button"
                onClick={handleCloseAddPanel}
                className="text-xs font-medium text-ink-soft"
              >
                Kapat
              </button>
            </div>

            {addPanelState === 'loading' && (
              <p className="mt-3 text-sm text-ink-soft">Yükleniyor…</p>
            )}

            {addPanelState === 'error' && (
              <p className="mt-3 text-sm text-ink-soft">
                Bilgiler yüklenirken bir hata oluştu. Lütfen paneli kapatıp tekrar dene.
              </p>
            )}

            {addPanelState === 'ready' && (
              <div className="mt-3 space-y-3">
                {invitableProfiles.length === 0 ? (
                  <p className="text-sm text-ink-soft">
                    Eklenebilecek kullanıcı bulunamadı. Bu dönemdeki tüm kullanıcılar zaten kayıtlı olabilir.
                  </p>
                ) : coordinatorRoleOptions.length === 0 ? (
                  <p className="text-sm text-ink-soft">
                    Aktif koordinatörlük bulunamadı. Önce koordinatörlük tanımlarını kontrol et.
                  </p>
                ) : (
                  <>
                    <label className="block text-sm">
                      <span className="mb-1 block font-medium text-ink">Kullanıcı</span>
                      <select
                        value={selectedProfileId}
                        onChange={(event) => setSelectedProfileId(event.target.value)}
                        className="w-full rounded-lg border border-canvas-border bg-canvas px-3 py-2 text-sm text-ink"
                      >
                        <option value="">Seç…</option>
                        {invitableProfiles.map((profile) => (
                          <option key={profile.id} value={profile.id}>
                            {profile.displayName}
                          </option>
                        ))}
                      </select>
                    </label>

                    <label className="block text-sm">
                      <span className="mb-1 block font-medium text-ink">Koordinatörlük</span>
                      <select
                        value={selectedCoordinatorRoleId}
                        onChange={(event) => setSelectedCoordinatorRoleId(event.target.value)}
                        className="w-full rounded-lg border border-canvas-border bg-canvas px-3 py-2 text-sm text-ink"
                      >
                        <option value="">Seç…</option>
                        {coordinatorRoleOptions.map((role) => (
                          <option key={role.id} value={role.id}>
                            {role.name}
                          </option>
                        ))}
                      </select>
                    </label>

                    <label className="block text-sm">
                      <span className="mb-1 block font-medium text-ink">Uygulama rolü</span>
                      <select
                        value={selectedAppRole}
                        onChange={(event) => setSelectedAppRole(event.target.value as AppRole | '')}
                        className="w-full rounded-lg border border-canvas-border bg-canvas px-3 py-2 text-sm text-ink"
                      >
                        <option value="">Seç…</option>
                        <option value="coordinator">Koordinatör</option>
                        <option value="super_admin">Süper Yönetici</option>
                      </select>
                    </label>

                    {formError && <p className="text-sm text-red-600">{formError}</p>}

                    <button
                      type="button"
                      onClick={handleAddMember}
                      disabled={isSubmitting}
                      className="w-full rounded-lg bg-accent-soft px-3 py-2 text-sm font-medium text-ink disabled:opacity-60"
                    >
                      {isSubmitting ? 'Ekleniyor…' : 'Döneme ekle'}
                    </button>
                  </>
                )}
              </div>
            )}
          </div>
        )}

        {members.length === 0 ? (
          <p className="mt-6 text-sm text-ink-soft">Bu dönemde henüz kayıtlı üye yok.</p>
        ) : (
          <ul className="mt-6 space-y-3">
            {members.map((member) => {
              const isEditingThisMember = editingMemberId === member.id
              return (
                <li
                  key={member.id}
                  className="rounded-lg border border-canvas-border bg-canvas-surface p-4 shadow-card"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-ink">{member.displayName}</p>
                      <p className="mt-1 text-sm text-ink-soft">
                        {member.coordinatorRoleName ?? 'Koordinatörlük atanmamış'}
                      </p>
                    </div>
                    {!isEditingThisMember && (
                      <button
                        type="button"
                        onClick={() => handleOpenEditPanel(member)}
                        className="shrink-0 text-xs font-medium text-ink-soft underline decoration-dotted"
                      >
                        Düzenle
                      </button>
                    )}
                  </div>

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

                  {isEditingThisMember && (
                    <div className="mt-4 rounded-lg border border-canvas-border bg-canvas p-3">
                      <div className="flex items-center justify-between">
                        <p className="text-sm font-semibold text-ink">Üyeyi düzenle</p>
                        <button
                          type="button"
                          onClick={handleCloseEditPanel}
                          className="text-xs font-medium text-ink-soft"
                        >
                          Kapat
                        </button>
                      </div>

                      {editPanelState === 'loading' && (
                        <p className="mt-3 text-sm text-ink-soft">Yükleniyor…</p>
                      )}

                      {editPanelState === 'error' && (
                        <p className="mt-3 text-sm text-ink-soft">
                          Bilgiler yüklenirken bir hata oluştu. Lütfen paneli kapatıp tekrar dene.
                        </p>
                      )}

                      {editPanelState === 'ready' && (
                        <div className="mt-3 space-y-3">
                          {coordinatorRoleOptions.length === 0 ? (
                            <p className="text-sm text-ink-soft">
                              Aktif koordinatörlük bulunamadı. Önce koordinatörlük tanımlarını kontrol et.
                            </p>
                          ) : (
                            <>
                              <label className="block text-sm">
                                <span className="mb-1 block font-medium text-ink">Koordinatörlük</span>
                                <select
                                  value={editCoordinatorRoleId}
                                  onChange={(event) => setEditCoordinatorRoleId(event.target.value)}
                                  className="w-full rounded-lg border border-canvas-border bg-canvas-surface px-3 py-2 text-sm text-ink"
                                >
                                  <option value="">Seç…</option>
                                  {coordinatorRoleOptions.map((role) => (
                                    <option key={role.id} value={role.id}>
                                      {role.name}
                                    </option>
                                  ))}
                                </select>
                              </label>

                              <label className="block text-sm">
                                <span className="mb-1 block font-medium text-ink">Uygulama rolü</span>
                                <select
                                  value={editAppRole}
                                  onChange={(event) => setEditAppRole(event.target.value as AppRole | '')}
                                  className="w-full rounded-lg border border-canvas-border bg-canvas-surface px-3 py-2 text-sm text-ink"
                                >
                                  <option value="">Seç…</option>
                                  <option value="coordinator">Koordinatör</option>
                                  <option value="super_admin">Süper Yönetici</option>
                                </select>
                              </label>

                              <label className="block text-sm">
                                <span className="mb-1 block font-medium text-ink">Üyelik durumu</span>
                                <select
                                  value={editIsActive ? 'active' : 'inactive'}
                                  onChange={(event) => setEditIsActive(event.target.value === 'active')}
                                  className="w-full rounded-lg border border-canvas-border bg-canvas-surface px-3 py-2 text-sm text-ink"
                                >
                                  <option value="active">Aktif</option>
                                  <option value="inactive">Pasif</option>
                                </select>
                              </label>

                              {editError && <p className="text-sm text-red-600">{editError}</p>}

                              <button
                                type="button"
                                onClick={() => handleSaveEdit(member)}
                                disabled={isEditSubmitting}
                                className="w-full rounded-lg bg-accent-soft px-3 py-2 text-sm font-medium text-ink disabled:opacity-60"
                              >
                                {isEditSubmitting ? 'Kaydediliyor…' : 'Kaydet'}
                              </button>
                            </>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </li>
              )
            })}
          </ul>
        )}
      </main>
    </div>
  )
}
