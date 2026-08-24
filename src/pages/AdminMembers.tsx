import { useCallback, useEffect, useMemo, useState } from 'react'
import type { Session } from '@supabase/supabase-js'
import AppShell from '../components/AppShell'
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
type CreateUserPanelState = 'idle' | 'loading' | 'ready' | 'error'

const fieldClass = 'min-h-[44px] w-full rounded-lg border border-canvas-border bg-canvas-surface px-3 py-2.5 text-sm text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand disabled:opacity-60'

function PlusIcon() {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4" aria-hidden="true"><path d="M12 5v14M5 12h14" /></svg>
}

function SearchIcon() {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5" aria-hidden="true"><circle cx="11" cy="11" r="7" /><path d="m16 16 4 4" /></svg>
}

function TeamIcon() {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5" aria-hidden="true"><circle cx="9" cy="8" r="3" /><path d="M3.5 19.5a5.5 5.5 0 0 1 11 0M15.5 12.5a4.5 4.5 0 0 1 5 4.5M17 5.5a2.5 2.5 0 0 1 0 5" /></svg>
}

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
  const { displayName, hasActiveMembership, appRole, periodId, periodLabel, coordinatorRoleName, loading: statusLoading } =
    useMembershipStatus(session)
  const [members, setMembers] = useState<MemberRow[]>([])
  const [loadState, setLoadState] = useState<LoadState>('loading')

  // Add-member panel state
  const [isAddOpen, setIsAddOpen] = useState(false)
  const [addPanelState, setAddPanelState] = useState<AddPanelState>('idle')
  const [invitableProfiles, setInvitableProfiles] = useState<InvitableProfile[]>([])
  const [coordinatorRoleOptions, setCoordinatorRoleOptions] = useState<CoordinatorRoleOption[]>([])
  const [selectedProfileId, setSelectedProfileId] = useState('')
  const [selectedPeriodDisplayName, setSelectedPeriodDisplayName] = useState('')
  const [selectedCoordinatorRoleId, setSelectedCoordinatorRoleId] = useState('')
  const [selectedAppRole, setSelectedAppRole] = useState<AppRole | ''>('')
  const [formError, setFormError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState('')

  // New-user panel state. Account creation is intentionally not connected yet.
  const [isCreateUserOpen, setIsCreateUserOpen] = useState(false)
  const [createUserState, setCreateUserState] = useState<CreateUserPanelState>('idle')
  const [newUserName, setNewUserName] = useState('')
  const [newUserEmail, setNewUserEmail] = useState('')
  const [newUserPassword, setNewUserPassword] = useState('')
  const [newUserPasswordConfirm, setNewUserPasswordConfirm] = useState('')
  const [newUserCoordinatorRoleId, setNewUserCoordinatorRoleId] = useState('')
  const [newUserAppRole, setNewUserAppRole] = useState<AppRole | ''>('')
  const [createUserError, setCreateUserError] = useState<string | null>(null)
  const [isCreatingUser, setIsCreatingUser] = useState(false)

  // Edit-member panel state
  const [editingMemberId, setEditingMemberId] = useState<string | null>(null)
  const [editPanelState, setEditPanelState] = useState<EditPanelState>('idle')
  const [editCoordinatorRoleId, setEditCoordinatorRoleId] = useState('')
  const [editPeriodDisplayName, setEditPeriodDisplayName] = useState('')
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
      .select('id, profile_id, period_display_name, coordinator_role_id, app_role, is_active, profiles!inner(display_name), coordinator_roles(name)')
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
        displayName: (row.period_display_name as string | null) ?? profile?.display_name ?? 'İsimsiz üye',
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
    setSelectedPeriodDisplayName('')
    setSelectedCoordinatorRoleId('')
    setSelectedAppRole('')
    setFormError(null)
  }, [])

  const resetCreateUserForm = useCallback(() => {
    setNewUserName('')
    setNewUserEmail('')
    setNewUserPassword('')
    setNewUserPasswordConfirm('')
    setNewUserCoordinatorRoleId('')
    setNewUserAppRole('')
    setCreateUserError(null)
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
    setIsCreateUserOpen(false)
    resetAddForm()
    setIsAddOpen(true)
    void loadInvitableData()
  }

  function handleCloseAddPanel() {
    setIsAddOpen(false)
    resetAddForm()
    setAddPanelState('idle')
  }

  function handleOpenCreateUserPanel() {
    setSuccessMessage(null)
    setEditingMemberId(null)
    setIsAddOpen(false)
    resetCreateUserForm()
    setIsCreateUserOpen(true)
    setCreateUserState('loading')
    void ensureCoordinatorRoleOptions().then((options) => {
      setCreateUserState(options === null ? 'error' : 'ready')
    })
  }

  function handleCloseCreateUserPanel() {
    setIsCreateUserOpen(false)
    resetCreateUserForm()
    setCreateUserState('idle')
  }

  async function handleAddMember() {
    setFormError(null)
    if (!periodId || !selectedProfileId || !selectedCoordinatorRoleId || !selectedAppRole) {
      setFormError('Kullanıcı, dönem görünen adı, koordinatörlük ve uygulama rolü seçilmelidir.')
      return
    }
    if (!selectedPeriodDisplayName.trim()) {
      setFormError('Dönem görünen adı boş olamaz.')
      return
    }

    setIsSubmitting(true)
    const { error } = await supabase.from('period_memberships').insert({
      period_id: periodId,
      profile_id: selectedProfileId,
      period_display_name: selectedPeriodDisplayName.trim(),
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

  async function handleCreateUser() {
    setCreateUserError(null)

    if (
      !newUserName.trim() ||
      !newUserEmail.trim() ||
      !newUserPassword ||
      !newUserPasswordConfirm ||
      !newUserCoordinatorRoleId ||
      !newUserAppRole
    ) {
      setCreateUserError('Lütfen tüm alanları doldurun.')
      return
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(newUserEmail.trim())) {
      setCreateUserError('Lütfen geçerli bir e-posta adresi girin.')
      return
    }
    if (newUserPassword.length < 8) {
      setCreateUserError('Şifre en az 8 karakter olmalıdır.')
      return
    }
    if (newUserPassword !== newUserPasswordConfirm) {
      setCreateUserError('Şifreler eşleşmiyor.')
      return
    }

    setIsCreatingUser(true)

    const { error } = await supabase.functions.invoke('create-user', {
      body: {
        fullName: newUserName.trim(),
        email: newUserEmail.trim(),
        password: newUserPassword,
        coordinatorRoleId: newUserCoordinatorRoleId,
        appRole: newUserAppRole,
      },
    })

    setIsCreatingUser(false)

    if (error) {
      let errorMessage = error.message
      const errorContext = (error as { context?: Response }).context

      if (errorContext) {
        try {
          const responseBody = (await errorContext.clone().json()) as { error?: unknown }
          if (typeof responseBody.error === 'string' && responseBody.error.trim()) {
            errorMessage = responseBody.error
          }
        } catch {
          // Supabase hata gövdesi JSON değilse genel mesajı kullan.
        }
      }

      setCreateUserError(`Kullanıcı oluşturulamadı: ${errorMessage}`)
      return
    }

    handleCloseCreateUserPanel()
    setSuccessMessage('Kullanıcı başarıyla oluşturuldu.')
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
    setIsCreateUserOpen(false)
    setEditingMemberId(member.id)
    setEditPeriodDisplayName(member.displayName)
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
    if (!editPeriodDisplayName.trim() || !editCoordinatorRoleId || !editAppRole) {
      setEditError('Dönem görünen adı, koordinatörlük ve uygulama rolü seçilmelidir.')
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
        period_display_name: editPeriodDisplayName.trim(),
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

  const filteredMembers = useMemo(() => {
    const query = searchQuery.trim().toLocaleLowerCase('tr-TR')
    if (!query) return members
    return members.filter((member) => [member.displayName, member.coordinatorRoleName, member.appRole === 'super_admin' ? 'Süper Yönetici' : 'Koordinatör']
      .some((value) => value?.toLocaleLowerCase('tr-TR').includes(query)))
  }, [members, searchQuery])

  async function handleSignOut() {
    await supabase.auth.signOut()
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
    <AppShell isSuperAdmin displayName={displayName} roleLabel={coordinatorRoleName ?? 'Süper Yönetici'} onSignOut={() => void handleSignOut()}>
      <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
        <div className="grid gap-4 lg:flex lg:items-end lg:justify-between">
          <div>
            <p className="text-sm text-ink-soft">Aktif dönem: <span className="font-medium text-brand-dark">{periodLabel ?? 'Belirtilmedi'}</span></p>
            <h1 className="mt-1 text-3xl font-semibold tracking-tight text-ink">Ekip Yönetimi</h1>
            <p className="mt-1 text-sm text-ink-soft">Dönem üyelerini, koordinatörlükleri ve uygulama yetkilerini yönet.</p>
          </div>
          <div className="grid gap-2 sm:flex">
            {!isCreateUserOpen ? <button type="button" onClick={handleOpenCreateUserPanel} className="flex min-h-[44px] items-center justify-center gap-2 rounded-lg border border-canvas-border bg-canvas-surface px-4 text-sm font-medium text-ink shadow-card hover:border-brand"><PlusIcon /> Yeni kullanıcı oluştur</button> : null}
            {!isAddOpen ? <button type="button" onClick={handleOpenAddPanel} className="flex min-h-[44px] items-center justify-center gap-2 rounded-lg bg-accent px-4 text-sm font-semibold text-white shadow-card hover:brightness-95"><PlusIcon /> Döneme üye ekle</button> : null}
          </div>
        </div>

        <div className="mt-5 grid gap-3 sm:grid-cols-3">
          <div className="flex items-center gap-3 rounded-xl border border-canvas-border bg-canvas-surface p-4 shadow-card"><span className="flex h-11 w-11 items-center justify-center rounded-full bg-brand-soft text-brand-dark"><TeamIcon /></span><div><p className="text-xs text-ink-soft">Toplam üye</p><p className="text-xl font-semibold text-ink">{members.length}</p></div></div>
          <div className="flex items-center gap-3 rounded-xl border border-canvas-border bg-canvas-surface p-4 shadow-card"><span className="flex h-11 w-11 items-center justify-center rounded-full bg-brand-soft text-brand-dark"><TeamIcon /></span><div><p className="text-xs text-ink-soft">Aktif üye</p><p className="text-xl font-semibold text-ink">{members.filter((member) => member.isActive).length}</p></div></div>
          <div className="flex items-center gap-3 rounded-xl border border-canvas-border bg-canvas-surface p-4 shadow-card"><span className="flex h-11 w-11 items-center justify-center rounded-full bg-accent-soft text-amber-800"><TeamIcon /></span><div><p className="text-xs text-ink-soft">Süper Yönetici</p><p className="text-xl font-semibold text-ink">{activeSuperAdminCount}</p></div></div>
        </div>

        {successMessage && (
          <p role="status" className="mt-4 rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800">
            {successMessage}
          </p>
        )}

        {(isAddOpen || isCreateUserOpen || editingMemberId) ? <button type="button" aria-label="Yönetim panelini kapat" onClick={() => { if (!isSubmitting && !isCreatingUser && !isEditSubmitting) { handleCloseAddPanel(); handleCloseCreateUserPanel(); handleCloseEditPanel() } }} className="fixed inset-0 z-40 hidden bg-ink/45 backdrop-blur-[1px] lg:block" /> : null}

        {isAddOpen && (
          <section role="dialog" aria-modal="true" aria-labelledby="add-member-title" className="fixed inset-0 z-50 overflow-y-auto bg-canvas-surface p-4 shadow-2xl sm:p-6 lg:left-auto lg:w-[min(32rem,calc(100vw-15rem))]" style={{ paddingTop: 'calc(1rem + env(safe-area-inset-top))', paddingBottom: 'calc(1rem + env(safe-area-inset-bottom))' }}>
            <div className="flex items-center justify-between border-b border-canvas-border pb-4">
              <div><h2 id="add-member-title" className="text-lg font-semibold text-ink">Döneme üye ekle</h2><p className="mt-1 text-xs text-ink-soft">Mevcut bir kullanıcıyı aktif döneme dahil et.</p></div>
              <button
                type="button"
                onClick={handleCloseAddPanel}
                className="min-h-[44px] rounded-md px-2 text-sm font-medium text-ink-soft"
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
                        onChange={(event) => {
                          const nextProfileId = event.target.value
                          setSelectedProfileId(nextProfileId)
                          const selectedProfile = invitableProfiles.find((profile) => profile.id === nextProfileId)
                          setSelectedPeriodDisplayName(selectedProfile?.displayName ?? '')
                        }}
                        className={fieldClass}
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
                      <span className="mb-1 block font-medium text-ink">Dönem görünen adı</span>
                      <input
                        type="text"
                        value={selectedPeriodDisplayName}
                        onChange={(event) => setSelectedPeriodDisplayName(event.target.value)}
                        placeholder="Örn: Numan Öndeş"
                        className={fieldClass}
                      />
                    </label>

                    <label className="block text-sm">
                      <span className="mb-1 block font-medium text-ink">Koordinatörlük</span>
                      <select
                        value={selectedCoordinatorRoleId}
                        onChange={(event) => setSelectedCoordinatorRoleId(event.target.value)}
                        className={fieldClass}
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
                        className={fieldClass}
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
                      className="min-h-[44px] w-full rounded-lg bg-accent px-3 text-sm font-semibold text-white disabled:opacity-60"
                    >
                      {isSubmitting ? 'Ekleniyor…' : 'Döneme ekle'}
                    </button>
                  </>
                )}
              </div>
            )}
          </section>
        )}

        {isCreateUserOpen && (
          <section role="dialog" aria-modal="true" aria-labelledby="create-user-title" className="fixed inset-0 z-50 flex flex-col overflow-hidden bg-canvas-surface shadow-2xl lg:left-auto lg:w-[min(42rem,calc(100vw-15rem))]" style={{ paddingTop: 'env(safe-area-inset-top)' }}>
            <div className="flex shrink-0 items-center justify-between gap-3 border-b border-canvas-border px-4 py-4 sm:px-6">
              <div className="flex min-w-0 items-center gap-3"><span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-brand-soft text-brand-dark"><TeamIcon /></span><div className="min-w-0"><h2 id="create-user-title" className="truncate text-lg font-semibold text-ink">Yeni kullanıcı oluştur</h2><p className="mt-1 text-xs text-ink-soft">Hesabı oluştur ve aktif döneme yetkileriyle ekle.</p></div></div>
              <button type="button" onClick={handleCloseCreateUserPanel} disabled={isCreatingUser} className="min-h-[44px] shrink-0 rounded-lg border border-canvas-border px-3 text-sm font-medium text-ink-soft hover:bg-canvas disabled:opacity-60">Kapat</button>
            </div>

            <div className="flex-1 overflow-y-auto px-4 py-5 sm:px-6">
            <p className="rounded-xl border border-brand/15 bg-brand-soft/30 px-4 py-3 text-xs leading-5 text-ink-soft">
              E-posta hesabı sabit kimliktir; dönem görünen adı yalnızca aktif dönem içindeki ekip ekranlarında kullanılır.
            </p>

            {createUserState === 'loading' && (
              <p className="mt-3 text-sm text-ink-soft">Koordinatörlükler yükleniyor…</p>
            )}

            {createUserState === 'error' && (
              <p className="mt-3 text-sm text-ink-soft">
                Koordinatörlükler yüklenirken bir hata oluştu. Paneli kapatıp tekrar dene.
              </p>
            )}

            {createUserState === 'ready' && (
              <div className="mt-4">
                {coordinatorRoleOptions.length === 0 ? (
                  <p className="text-sm text-ink-soft">Aktif koordinatörlük bulunamadı.</p>
                ) : (
                  <div className="space-y-4">
                    <section className="rounded-xl border border-canvas-border bg-canvas p-4 sm:p-5">
                      <div className="flex items-center gap-3"><span className="flex h-9 w-9 items-center justify-center rounded-lg bg-brand-soft text-brand-dark"><TeamIcon /></span><div><h3 className="text-sm font-semibold text-ink">Hesap bilgileri</h3><p className="mt-0.5 text-xs text-ink-soft">Kullanıcının kimlik ve giriş bilgileri.</p></div></div>
                      <div className="mt-4 grid gap-4 sm:grid-cols-2">
                        <label className="block text-sm sm:col-span-2"><span className="mb-1.5 block font-medium text-ink">Dönem görünen adı</span><input type="text" value={newUserName} onChange={(event) => setNewUserName(event.target.value)} placeholder="Örn: Ahmet Yılmaz" autoComplete="name" className={fieldClass} /></label>
                        <label className="block text-sm sm:col-span-2"><span className="mb-1.5 block font-medium text-ink">Kişisel e-posta</span><input type="email" value={newUserEmail} onChange={(event) => setNewUserEmail(event.target.value)} placeholder="ahmet@ornek.com" autoComplete="email" className={fieldClass} /></label>
                        <label className="block text-sm"><span className="mb-1.5 block font-medium text-ink">Geçici şifre</span><input type="password" value={newUserPassword} onChange={(event) => setNewUserPassword(event.target.value)} placeholder="En az 8 karakter" autoComplete="new-password" className={fieldClass} /></label>
                        <label className="block text-sm"><span className="mb-1.5 block font-medium text-ink">Geçici şifre tekrar</span><input type="password" value={newUserPasswordConfirm} onChange={(event) => setNewUserPasswordConfirm(event.target.value)} placeholder="Şifreyi onayla" autoComplete="new-password" className={fieldClass} /></label>
                      </div>
                    </section>

                    <section className="rounded-xl border border-canvas-border bg-canvas p-4 sm:p-5">
                      <div className="flex items-center gap-3"><span className="flex h-9 w-9 items-center justify-center rounded-lg bg-accent-soft text-amber-800"><TeamIcon /></span><div><h3 className="text-sm font-semibold text-ink">Dönem ve yetki</h3><p className="mt-0.5 text-xs text-ink-soft">Koordinatörlük ve uygulama erişim seviyesi.</p></div></div>
                      <div className="mt-4 grid gap-4 sm:grid-cols-2">
                        <label className="block text-sm"><span className="mb-1.5 block font-medium text-ink">Koordinatörlük</span><select value={newUserCoordinatorRoleId} onChange={(event) => setNewUserCoordinatorRoleId(event.target.value)} className={fieldClass}><option value="">Seç…</option>{coordinatorRoleOptions.map((role) => <option key={role.id} value={role.id}>{role.name}</option>)}</select></label>
                        <label className="block text-sm"><span className="mb-1.5 block font-medium text-ink">Uygulama rolü</span><select value={newUserAppRole} onChange={(event) => setNewUserAppRole(event.target.value as AppRole | '')} className={fieldClass}><option value="">Seç…</option><option value="coordinator">Koordinatör</option><option value="super_admin">Süper Yönetici</option></select></label>
                      </div>
                    </section>

                    {createUserError && <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{createUserError}</p>}
                  </div>
                )}
              </div>
            )}
            </div>
            <div className="flex shrink-0 flex-col-reverse gap-2 border-t border-canvas-border bg-canvas px-4 py-4 sm:flex-row sm:justify-end sm:px-6" style={{ paddingBottom: 'calc(1rem + env(safe-area-inset-bottom))' }}>
              <button type="button" onClick={handleCloseCreateUserPanel} disabled={isCreatingUser} className="inline-flex min-h-11 w-full items-center justify-center rounded-lg border border-brand px-5 text-sm font-semibold text-brand-dark hover:bg-brand-soft disabled:opacity-60 sm:w-auto">İptal</button>
              <button type="button" onClick={handleCreateUser} disabled={isCreatingUser || createUserState !== 'ready' || coordinatorRoleOptions.length === 0} className="inline-flex min-h-11 w-full items-center justify-center rounded-lg bg-accent px-6 text-sm font-semibold text-white shadow-card disabled:opacity-60 sm:w-auto">{isCreatingUser ? 'Oluşturuluyor…' : 'Kullanıcıyı oluştur'}</button>
            </div>
          </section>
        )}

        <section className="mt-5 rounded-xl border border-canvas-border bg-canvas-surface p-4 shadow-card">
          <label className="relative block">
            <span className="sr-only">Ekip üyesi ara</span>
            <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-ink-soft"><SearchIcon /></span>
            <input value={searchQuery} onChange={(event) => setSearchQuery(event.target.value)} placeholder="İsim, koordinatörlük veya rol ara" className={`${fieldClass} pl-10`} />
          </label>
        </section>

        {filteredMembers.length === 0 ? (
          <section className="mt-5 rounded-xl border border-canvas-border bg-canvas-surface px-5 py-10 text-center shadow-card"><span className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-brand-soft text-brand-dark"><TeamIcon /></span><h2 className="mt-3 font-semibold text-ink">{members.length === 0 ? 'Bu dönemde kayıtlı üye yok' : 'Aramana uygun üye bulunamadı'}</h2><p className="mt-1 text-sm text-ink-soft">{members.length === 0 ? 'Yeni kullanıcı oluşturabilir veya mevcut bir kullanıcıyı döneme ekleyebilirsin.' : 'Arama metnini değiştirerek tekrar deneyebilirsin.'}</p></section>
        ) : (
          <ul className="mt-5 grid gap-4 xl:grid-cols-2">
            {filteredMembers.map((member) => {
              const isEditingThisMember = editingMemberId === member.id
              return (
                <li
                  key={member.id}
                  className={`rounded-xl border bg-canvas-surface p-4 shadow-card sm:p-5 ${member.isActive ? 'border-canvas-border' : 'border-danger/20 opacity-75'}`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex min-w-0 gap-3">
                      <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-brand-soft text-sm font-semibold text-brand-dark">{member.displayName.split(' ').map((part) => part[0]).join('').slice(0, 2).toLocaleUpperCase('tr-TR')}</span>
                      <div className="min-w-0">
                      <p className="break-words text-base font-semibold text-ink">{member.displayName}</p>
                      <p className="mt-1 text-sm text-ink-soft">
                        {member.coordinatorRoleName ?? 'Koordinatörlük atanmamış'}
                      </p>
                      </div>
                    </div>
                    {!isEditingThisMember && (
                      <button
                        type="button"
                        onClick={() => handleOpenEditPanel(member)}
                        className="min-h-[44px] shrink-0 rounded-md border border-canvas-border px-3 text-sm font-medium text-ink-soft hover:border-brand"
                      >
                        Düzenle
                      </button>
                    )}
                  </div>

                  <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
                    <span className={`rounded-full border px-2.5 py-1 font-medium ${member.appRole === 'super_admin' ? 'border-accent/20 bg-accent-soft text-amber-800' : 'border-brand-dark/15 bg-brand-soft text-brand-dark'}`}>
                      {member.appRole === 'super_admin' ? 'Süper Yönetici' : 'Koordinatör'}
                    </span>
                    <span
                      className={
                        member.isActive
                          ? 'rounded-full border border-brand-dark/15 bg-brand-soft px-2.5 py-1 font-medium text-brand-dark'
                          : 'rounded-full border border-danger/20 bg-danger-soft px-2.5 py-1 font-medium text-danger'
                      }
                    >
                      {member.isActive ? 'Aktif' : 'Pasif'}
                    </span>
                  </div>

                  {isEditingThisMember && (
                    <section role="dialog" aria-modal="true" aria-labelledby={`edit-member-${member.id}`} className="fixed inset-0 z-50 overflow-y-auto bg-canvas-surface p-4 shadow-2xl sm:p-6 lg:left-auto lg:w-[min(32rem,calc(100vw-15rem))]" style={{ paddingTop: 'calc(1rem + env(safe-area-inset-top))', paddingBottom: 'calc(1rem + env(safe-area-inset-bottom))' }}>
                      <div className="flex items-center justify-between border-b border-canvas-border pb-4">
                        <div><h2 id={`edit-member-${member.id}`} className="text-lg font-semibold text-ink">Üyeyi düzenle</h2><p className="mt-1 text-xs text-ink-soft">{member.displayName} için dönem ve yetki bilgileri.</p></div>
                        <button
                          type="button"
                          onClick={handleCloseEditPanel}
                          className="min-h-[44px] rounded-md px-2 text-sm font-medium text-ink-soft"
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
                                <span className="mb-1 block font-medium text-ink">Dönem görünen adı</span>
                                <input
                                  type="text"
                                  value={editPeriodDisplayName}
                                  onChange={(event) => setEditPeriodDisplayName(event.target.value)}
                                  placeholder="Örn: Numan Öndeş"
                                  className={fieldClass}
                                />
                              </label>

                              <label className="block text-sm">
                                <span className="mb-1 block font-medium text-ink">Koordinatörlük</span>
                                <select
                                  value={editCoordinatorRoleId}
                                  onChange={(event) => setEditCoordinatorRoleId(event.target.value)}
                                  className={fieldClass}
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
                                  className={fieldClass}
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
                                  className={fieldClass}
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
                                className="min-h-[44px] w-full rounded-lg bg-accent px-3 text-sm font-semibold text-white disabled:opacity-60"
                              >
                                {isEditSubmitting ? 'Kaydediliyor…' : 'Kaydet'}
                              </button>
                            </>
                          )}
                        </div>
                      )}
                    </section>
                  )}
                </li>
              )
            })}
          </ul>
        )}
      </main>
    </AppShell>
  )
}
