import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { Session } from '@supabase/supabase-js'
import { useSearchParams } from 'react-router-dom'
import AppShell from '../components/AppShell'
import PermanentDeleteDialog from '../components/PermanentDeleteDialog'
import { supabase } from '../lib/supabaseClient'
import { deleteAwarenessPostPermanently } from '../lib/permanentDeletion'
import { useMembershipStatus } from '../hooks/useMembershipStatus'

interface StatusOption {
  slug: string
  label: string
}

interface MembershipRow {
  profile_id: string
  period_display_name: string
}

interface AwarenessRow {
  id: string
  awareness_name: string
  scope: string | null
  start_date: string | null
  end_date: string | null
  estimated_date: string | null
  share_date: string | null
  preparation_start_date: string | null
  closing_date: string | null
  design_status: string
  announcement_text_status: string
  sharing_status: string
  design_responsible_id: string | null
  press_publication_responsible_id: string | null
  record_check_status: string
  next_action: string | null
  note: string | null
  drive_folder_url: string | null
  design_url: string | null
  share_url: string | null
  created_by: string
  deleted_at: string | null
}

interface ProfileOption {
  id: string
  name: string
}

interface AwarenessPost {
  id: string
  awarenessName: string
  scope: string | null
  startDate: string | null
  endDate: string | null
  estimatedDate: string | null
  shareDate: string | null
  preparationStartDate: string | null
  closingDate: string | null
  designStatus: string
  announcementStatus: string
  sharingStatus: string
  designResponsibleId: string | null
  pressResponsibleId: string | null
  recordCheckStatus: string
  nextAction: string | null
  note: string | null
  driveFolderUrl: string | null
  designUrl: string | null
  shareUrl: string | null
  createdBy: string
  deletedAt: string | null
}

interface AwarenessSuggestionPayload {
  name: string
  category: string
  content_idea: string
  draft_text: string
  visual_idea: string
  pharmacy_relevance: string
  suggested_preparation_date: string
  suggested_share_date: string
  source_name: string
  source_url: string
}

interface AwarenessSuggestion {
  id: string
  targetDate: string
  targetEndDate: string | null
  status: 'new' | 'seen'
  payload: AwarenessSuggestionPayload
}

type FormMode = 'closed' | 'create' | 'edit'
type ListFilter = 'all' | 'waiting' | 'shared' | 'delayed'

const fieldClass = 'min-h-[44px] rounded-lg border border-canvas-border bg-canvas px-3 py-2.5 font-normal text-ink placeholder:text-ink-soft/70 focus-visible:border-brand focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/15 disabled:cursor-not-allowed disabled:opacity-60'
const focusableSelector = 'button:not([disabled]), textarea:not([disabled]), select:not([disabled]), input:not([disabled]), [tabindex]:not([tabindex="-1"])'

function AwarenessIcon() {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" className="h-6 w-6" aria-hidden="true"><path d="M19.5 4.5C13 4.7 8.5 7.2 8.5 12.1c0 2.9 2 5 4.8 5 4.8 0 6.7-5.8 6.2-12.6Z" /><path d="M4.5 20c1.8-4.9 5.1-8.2 10.4-10.4" /><path d="m5 5 .45 1.35L6.8 6.8l-1.35.45L5 8.6l-.45-1.35L3.2 6.8l1.35-.45z" /></svg>
}

function EmptyAwarenessIcon() {
  return <AwarenessIcon />
}

function PlusIcon() {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4" aria-hidden="true"><path d="M12 5v14M5 12h14" /></svg>
}

function CloseIcon() {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5" aria-hidden="true"><path d="m6 6 12 12M18 6 6 18" /></svg>
}

function SearchIcon() {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5" aria-hidden="true"><circle cx="11" cy="11" r="7" /><path d="m16 16 4 4" /></svg>
}

function FilterIcon() {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5" aria-hidden="true"><path d="M4 5h16l-6 7v5l-4 2v-7z" /></svg>
}

function SelectChevronIcon() {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4" aria-hidden="true"><path d="m7 9 5 5 5-5" /></svg>
}

function CalendarIcon() {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4" aria-hidden="true"><rect x="3.5" y="4.5" width="17" height="16" rx="2" /><path d="M3.5 9.5h17M8 3v3M16 3v3" /></svg>
}

function PersonIcon() {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4" aria-hidden="true"><circle cx="12" cy="8" r="3.25" /><path d="M5.5 20a6.5 6.5 0 0 1 13 0" /></svg>
}

function LinkIcon() {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4" aria-hidden="true"><path d="M10 13a5 5 0 0 0 7.5.5l2-2a5 5 0 0 0-7-7l-1.1 1.1M14 11a5 5 0 0 0-7.5-.5l-2 2a5 5 0 0 0 7 7l1.1-1.1" /></svg>
}

function parseDateOnly(value: string | null): Date | null {
  if (!value) return null
  const [year, month, day] = value.split('-').map(Number)
  if (![year, month, day].every(Number.isFinite)) return null
  const date = new Date(Date.UTC(year, month - 1, day))
  return Number.isNaN(date.getTime()) ? null : date
}

function formatDate(value: string | null): string {
  const date = parseDateOnly(value)
  if (!date) return 'Belirtilmedi'
  return new Intl.DateTimeFormat('tr-TR', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(date)
}

function formatMonthYear(value: string | null): string {
  const date = parseDateOnly(value)
  if (!date) return 'Belirtilmedi'
  return new Intl.DateTimeFormat('tr-TR', {
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(date)
}

function isDelayed(shareDate: string | null, sharingStatus: string): boolean {
  if (!shareDate || sharingStatus === 'shared') return false
  const target = parseDateOnly(shareDate)
  if (!target) return false
  const today = new Date()
  const todayUtc = Date.UTC(today.getFullYear(), today.getMonth(), today.getDate())
  return target.getTime() < todayUtc
}

function isValidUrl(value: string): boolean {
  if (!value.trim()) return true
  return /^https?:\/\//i.test(value.trim())
}

function CenteredMessage({ text }: { text: string }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-canvas px-4">
      <p className="text-center text-sm text-ink-soft">{text}</p>
    </div>
  )
}

export default function AwarenessPosts({ session }: { session: Session }) {
  const [searchParams, setSearchParams] = useSearchParams()
  const { displayName, hasActiveMembership, profileId, periodId, periodLabel, appRole, coordinatorRoleName, coordinatorRoleSlug, loading: statusLoading } = useMembershipStatus(session)
  const isSuperAdmin = appRole === 'super_admin'
  const canReviewAiSuggestions = isSuperAdmin || coordinatorRoleSlug === 'public-health-coordinator'
  const [posts, setPosts] = useState<AwarenessPost[]>([])
  const [profiles, setProfiles] = useState<ProfileOption[]>([])
  const [designStatuses, setDesignStatuses] = useState<StatusOption[]>([])
  const [announcementStatuses, setAnnouncementStatuses] = useState<StatusOption[]>([])
  const [sharingStatuses, setSharingStatuses] = useState<StatusOption[]>([])
  const [recordCheckStatuses, setRecordCheckStatuses] = useState<StatusOption[]>([])
  const [loadState, setLoadState] = useState<'loading' | 'ready' | 'error'>('loading')
  const [reloadKey, setReloadKey] = useState(0)
  const [showInactive, setShowInactive] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [listFilter, setListFilter] = useState<ListFilter>('all')
  const [formMode, setFormMode] = useState<FormMode>('closed')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [suggestions, setSuggestions] = useState<AwarenessSuggestion[]>([])
  const [suggestionsLoading, setSuggestionsLoading] = useState(false)
  const [suggestionError, setSuggestionError] = useState<string | null>(null)
  const [suggestionTransferId, setSuggestionTransferId] = useState<string | null>(null)
  const suggestionSectionRef = useRef<HTMLElement>(null)
  const panelRef = useRef<HTMLElement>(null)
  const closeButtonRef = useRef<HTMLButtonElement>(null)
  const previouslyFocusedRef = useRef<HTMLElement | null>(null)

  const [awarenessName, setAwarenessName] = useState('')
  const [scope, setScope] = useState('')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [estimatedDate, setEstimatedDate] = useState('')
  const [shareDate, setShareDate] = useState('')
  const [preparationStartDate, setPreparationStartDate] = useState('')
  const [closingDate, setClosingDate] = useState('')
  const [designStatus, setDesignStatus] = useState('not_started')
  const [announcementStatus, setAnnouncementStatus] = useState('not_started')
  const [sharingStatus, setSharingStatus] = useState('not_shared')
  const [recordCheckStatus, setRecordCheckStatus] = useState('pending_check')
  const [designResponsibleId, setDesignResponsibleId] = useState('')
  const [pressResponsibleId, setPressResponsibleId] = useState('')
  const [nextAction, setNextAction] = useState('')
  const [note, setNote] = useState('')
  const [driveFolderUrl, setDriveFolderUrl] = useState('')
  const [designUrl, setDesignUrl] = useState('')
  const [shareUrl, setShareUrl] = useState('')
  const [isSaving, setIsSaving] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<AwarenessPost | null>(null)
  const [deleteError, setDeleteError] = useState<string | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)
  const savingRef = useRef(isSaving)
  savingRef.current = isSaving

  const closeDeleteDialog = useCallback(() => {
    if (isDeleting) return
    setDeleteTarget(null)
    setDeleteError(null)
  }, [isDeleting])

  async function handlePermanentDelete() {
    if (!deleteTarget?.deletedAt) return
    setIsDeleting(true)
    setDeleteError(null)
    try {
      const result = await deleteAwarenessPostPermanently(deleteTarget.id)
      setSuccessMessage(result.cleanupWarning ?? `“${deleteTarget.awarenessName}” farkındalık kaydı kalıcı olarak silindi.`)
      setDeleteTarget(null)
      setReloadKey((value) => value + 1)
    } catch (error) {
      setDeleteError(error instanceof Error ? error.message : 'Farkındalık kaydı silinemedi.')
    } finally {
      setIsDeleting(false)
    }
  }

  useEffect(() => {
    if (formMode === 'closed') return
    previouslyFocusedRef.current = document.activeElement as HTMLElement | null
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    window.setTimeout(() => closeButtonRef.current?.focus(), 0)

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !savingRef.current) {
        event.preventDefault()
        setFormMode('closed')
        return
      }
      if (event.key !== 'Tab') return
      const panel = panelRef.current
      if (!panel) return
      const focusable = Array.from(panel.querySelectorAll<HTMLElement>(focusableSelector)).filter((element) => element.offsetParent !== null)
      if (focusable.length === 0) return
      const first = focusable[0]
      const last = focusable[focusable.length - 1]
      if (event.shiftKey && (document.activeElement === first || !panel.contains(document.activeElement))) {
        event.preventDefault()
        last.focus()
      } else if (!event.shiftKey && (document.activeElement === last || !panel.contains(document.activeElement))) {
        event.preventDefault()
        first.focus()
      }
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('keydown', handleKeyDown)
      document.body.style.overflow = previousOverflow
      previouslyFocusedRef.current?.focus()
    }
  }, [formMode])

  useEffect(() => {
    if (statusLoading) return
    if (!hasActiveMembership || !periodId) {
      setLoadState('ready')
      return
    }

    let isMounted = true
    async function loadData() {
      setLoadState('loading')
      const [membersResult, designResult, announcementResult, sharingResult, checkResult] = await Promise.all([
        supabase.from('period_memberships').select('profile_id, period_display_name').eq('period_id', periodId).eq('is_active', true),
        supabase.from('awareness_design_statuses').select('slug, label').eq('is_active', true).order('sort_order'),
        supabase.from('awareness_announcement_statuses').select('slug, label').eq('is_active', true).order('sort_order'),
        supabase.from('awareness_sharing_statuses').select('slug, label').eq('is_active', true).order('sort_order'),
        supabase.from('awareness_record_check_statuses').select('slug, label').eq('is_active', true).order('sort_order'),
      ])

      if (!isMounted) return
      if (membersResult.error || designResult.error || announcementResult.error || sharingResult.error || checkResult.error) {
        setLoadState('error')
        return
      }

      const membershipRows = (membersResult.data ?? []) as unknown as MembershipRow[]
      setProfiles(membershipRows.map((member) => ({
        id: member.profile_id,
        name: member.period_display_name || 'İsimsiz',
      })))
      setDesignStatuses((designResult.data ?? []) as unknown as StatusOption[])
      setAnnouncementStatuses((announcementResult.data ?? []) as unknown as StatusOption[])
      setSharingStatuses((sharingResult.data ?? []) as unknown as StatusOption[])
      setRecordCheckStatuses((checkResult.data ?? []) as unknown as StatusOption[])

      let query = supabase
        .from('awareness_posts')
        .select('*')
        .eq('period_id', periodId)
        .order('start_date', { ascending: true, nullsFirst: false })
        .order('share_date', { ascending: true, nullsFirst: false })
      if (!showInactive) query = query.is('deleted_at', null)

      const postsResult = await query
      if (!isMounted) return
      if (postsResult.error) {
        setLoadState('error')
        return
      }

      const rows = (postsResult.data ?? []) as unknown as AwarenessRow[]
      setPosts(rows.map((row) => ({
        id: row.id,
        awarenessName: row.awareness_name,
        scope: row.scope,
        startDate: row.start_date,
        endDate: row.end_date,
        estimatedDate: row.estimated_date,
        shareDate: row.share_date,
        preparationStartDate: row.preparation_start_date,
        closingDate: row.closing_date,
        designStatus: row.design_status,
        announcementStatus: row.announcement_text_status,
        sharingStatus: row.sharing_status,
        designResponsibleId: row.design_responsible_id,
        pressResponsibleId: row.press_publication_responsible_id,
        recordCheckStatus: row.record_check_status,
        nextAction: row.next_action,
        note: row.note,
        driveFolderUrl: row.drive_folder_url,
        designUrl: row.design_url,
        shareUrl: row.share_url,
        createdBy: row.created_by,
        deletedAt: row.deleted_at,
      })))
      setLoadState('ready')
    }

    void loadData()
    return () => {
      isMounted = false
    }
  }, [hasActiveMembership, periodId, reloadKey, showInactive, statusLoading])

  useEffect(() => {
    if (statusLoading || !hasActiveMembership || !periodId || !canReviewAiSuggestions) return
    let isMounted = true

    async function loadSuggestions() {
      setSuggestionsLoading(true)
      setSuggestionError(null)

      // Tarama sunucuda kaynaklı tarih kataloğunu kullanır. Yeni aday yoksa model çağrısı yapılmaz.
      await supabase.functions.invoke('ai-orchestrator', { body: { operation: 'awareness_suggestion' } })
      const { data, error } = await supabase
        .from('ai_awareness_suggestions')
        .select('id, target_date, target_end_date, status, payload')
        .eq('period_id', periodId)
        .in('status', ['new', 'seen'])
        .order('target_date', { ascending: true })

      if (!isMounted) return
      setSuggestionsLoading(false)
      if (error) {
        setSuggestionError('MUPİ içerik fırsatları şu anda yüklenemedi.')
        return
      }
      const nextSuggestions = (data ?? []).map((row) => ({
        id: row.id as string,
        targetDate: row.target_date as string,
        targetEndDate: (row.target_end_date as string | null) ?? null,
        status: row.status as 'new' | 'seen',
        payload: row.payload as unknown as AwarenessSuggestionPayload,
      }))
      setSuggestions(nextSuggestions)

      const requestedId = searchParams.get('suggestion')
      if (requestedId && nextSuggestions.some((item) => item.id === requestedId)) {
        await supabase.from('ai_awareness_suggestions').update({ status: 'seen' }).eq('id', requestedId).eq('status', 'new')
        window.setTimeout(() => suggestionSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 100)
      }
    }

    void loadSuggestions()
    return () => { isMounted = false }
  }, [canReviewAiSuggestions, hasActiveMembership, periodId, searchParams, statusLoading])

  function resetForm() {
    setAwarenessName('')
    setScope('')
    setStartDate('')
    setEndDate('')
    setEstimatedDate('')
    setShareDate('')
    setPreparationStartDate('')
    setClosingDate('')
    setDesignStatus('not_started')
    setAnnouncementStatus('not_started')
    setSharingStatus('not_shared')
    setRecordCheckStatus('pending_check')
    setDesignResponsibleId('')
    setPressResponsibleId('')
    setNextAction('')
    setNote('')
    setDriveFolderUrl('')
    setDesignUrl('')
    setShareUrl('')
    setEditingId(null)
    setSuggestionTransferId(null)
    setFormError(null)
  }

  function openCreate() {
    resetForm()
    setFormMode('create')
    setSuccessMessage(null)
  }

  function openEdit(post: AwarenessPost) {
    setSuggestionTransferId(null)
    setEditingId(post.id)
    setAwarenessName(post.awarenessName)
    setScope(post.scope ?? '')
    setStartDate(post.startDate ?? '')
    setEndDate(post.endDate ?? '')
    setEstimatedDate(post.estimatedDate ?? '')
    setShareDate(post.shareDate ?? '')
    setPreparationStartDate(post.preparationStartDate ?? '')
    setClosingDate(post.closingDate ?? '')
    setDesignStatus(post.designStatus)
    setAnnouncementStatus(post.announcementStatus)
    setSharingStatus(post.sharingStatus)
    setRecordCheckStatus(post.recordCheckStatus)
    setDesignResponsibleId(post.designResponsibleId ?? '')
    setPressResponsibleId(post.pressResponsibleId ?? '')
    setNextAction(post.nextAction ?? '')
    setNote(post.note ?? '')
    setDriveFolderUrl(post.driveFolderUrl ?? '')
    setDesignUrl(post.designUrl ?? '')
    setShareUrl(post.shareUrl ?? '')
    setFormError(null)
    setSuccessMessage(null)
    setFormMode('edit')
  }

  function transferSuggestionToForm(suggestion: AwarenessSuggestion) {
    resetForm()
    const payload = suggestion.payload
    setAwarenessName(payload.name)
    setScope(payload.content_idea)
    setStartDate(suggestion.targetDate)
    setEndDate(suggestion.targetEndDate ?? suggestion.targetDate)
    setEstimatedDate(payload.suggested_share_date || suggestion.targetDate)
    setShareDate(payload.suggested_share_date || suggestion.targetDate)
    setPreparationStartDate(payload.suggested_preparation_date || '')
    setNextAction('İçerik kapsamını ekipçe doğrula ve tasarım planını oluştur.')
    setNote(`MUPİ içerik taslağı (yayınlamadan önce doğrulayın):\n${payload.draft_text}\n\nGörsel fikri:\n${payload.visual_idea}\n\nEczacılık bağlantısı:\n${payload.pharmacy_relevance}\n\nKaynak: ${payload.source_name} — ${payload.source_url}`)
    setSuggestionTransferId(suggestion.id)
    setSuccessMessage(null)
    setFormMode('create')
  }

  async function dismissSuggestion(suggestionId: string) {
    const { error } = await supabase.from('ai_awareness_suggestions').update({ status: 'dismissed' }).eq('id', suggestionId)
    if (error) {
      setSuggestionError('Öneri kapatılamadı.')
      return
    }
    setSuggestions((current) => current.filter((item) => item.id !== suggestionId))
    if (searchParams.get('suggestion') === suggestionId) {
      const next = new URLSearchParams(searchParams)
      next.delete('suggestion')
      setSearchParams(next, { replace: true })
    }
  }

  async function handleSave() {
    if (!periodId || !profileId) return
    setFormError(null)
    if (!awarenessName.trim()) {
      setFormError('Farkındalık adı zorunludur.')
      return
    }
    if (startDate && endDate && startDate > endDate) {
      setFormError('Başlangıç günü, bitiş gününden sonra olamaz.')
      return
    }
    if (![driveFolderUrl, designUrl, shareUrl].every(isValidUrl)) {
      setFormError('Linkler http:// veya https:// ile başlamalıdır.')
      return
    }

    setIsSaving(true)
    const payload = {
      awareness_name: awarenessName.trim(),
      scope: scope.trim() || null,
      start_date: startDate || null,
      end_date: endDate || null,
      estimated_date: estimatedDate || null,
      share_date: shareDate || null,
      preparation_start_date: preparationStartDate || null,
      closing_date: closingDate || null,
      design_status: designStatus,
      announcement_text_status: announcementStatus,
      sharing_status: sharingStatus,
      record_check_status: recordCheckStatus,
      design_responsible_id: designResponsibleId || null,
      press_publication_responsible_id: pressResponsibleId || null,
      next_action: nextAction.trim() || null,
      note: note.trim() || null,
      drive_folder_url: driveFolderUrl.trim() || null,
      design_url: designUrl.trim() || null,
      share_url: shareUrl.trim() || null,
    }

    const result = formMode === 'create'
      ? await supabase.from('awareness_posts').insert({ period_id: periodId, created_by: profileId, ...payload })
      : await supabase.from('awareness_posts').update(payload).eq('id', editingId)

    setIsSaving(false)
    if (result.error) {
      const message = result.error.message.toLowerCase()
      setFormError(message.includes('kilit') ? 'Dönem kilitli olduğu için işlem yapılamaz.' : 'Kayıt kaydedilemedi. Yetki ve tarih bilgilerini kontrol edin.')
      return
    }

    if (formMode === 'create' && suggestionTransferId) {
      await supabase.from('ai_awareness_suggestions').update({ status: 'transferred' }).eq('id', suggestionTransferId)
      setSuggestions((current) => current.filter((item) => item.id !== suggestionTransferId))
      const next = new URLSearchParams(searchParams)
      next.delete('suggestion')
      setSearchParams(next, { replace: true })
    }

    setFormMode('closed')
    setSuccessMessage(formMode === 'create' ? 'Farkındalık başarıyla eklendi.' : 'Farkındalık başarıyla güncellendi.')
    setReloadKey((value) => value + 1)
  }

  async function toggleActive(post: AwarenessPost) {
    if (!profileId) return
    const isDeactivating = !post.deletedAt
    if (isDeactivating && !window.confirm('Bu kaydı pasifleştirmek istediğinize emin misiniz? Bağlı görevler ve görev kayıtları da otomatik olarak pasifleştirilecek.')) return

    const result = await supabase
      .from('awareness_posts')
      .update(isDeactivating
        ? { deleted_at: new Date().toISOString(), deleted_by: profileId, deletion_note: 'Kullanıcı pasifleştirdi' }
        : { deleted_at: null, deleted_by: null, deletion_note: null })
      .eq('id', post.id)

    if (result.error) {
      setSuccessMessage(result.error.message.toLowerCase().includes('kilit') ? 'Dönem kilitli olduğu için işlem yapılamadı.' : 'Kayıt güncellenemedi.')
      return
    }
    setSuccessMessage(isDeactivating ? 'Kayıt ve bağlı görevleri pasifleştirildi.' : 'Kayıt ve otomatik pasifleştirilen bağlı görevleri yeniden aktifleştirildi.')
    setReloadKey((value) => value + 1)
  }

  function getStatusLabel(slug: string, options: StatusOption[]): string {
    return options.find((option) => option.slug === slug)?.label ?? 'Belirtilmedi'
  }

  function getProfileName(id: string | null): string {
    return profiles.find((profile) => profile.id === id)?.name ?? 'Atanmamış'
  }

  function getStatusTone(slug: string): string {
    if (['shared', 'completed', 'approved', 'checked', 'done'].some((value) => slug.includes(value))) {
      return 'border-brand-dark/15 bg-brand-soft text-brand-dark'
    }
    if (['progress', 'preparing', 'waiting', 'pending', 'scheduled', 'drafting'].some((value) => slug.includes(value))) {
      return 'border-accent/20 bg-accent-soft text-amber-800'
    }
    return 'border-canvas-border bg-canvas text-ink-soft'
  }

  const filteredPosts = useMemo(() => {
    const normalizedQuery = searchQuery.trim().toLocaleLowerCase('tr-TR')
    return posts.filter((post) => {
      const delayed = isDelayed(post.shareDate, post.sharingStatus)
      const matchesQuery = !normalizedQuery || [post.awarenessName, post.scope, post.nextAction]
        .some((value) => value?.toLocaleLowerCase('tr-TR').includes(normalizedQuery))
      const matchesFilter = listFilter === 'all'
        || (listFilter === 'delayed' && delayed)
        || (listFilter === 'shared' && post.sharingStatus === 'shared')
        || (listFilter === 'waiting' && post.sharingStatus !== 'shared' && !delayed)
      return matchesQuery && matchesFilter
    })
  }, [listFilter, posts, searchQuery])

  async function handleSignOut() {
    await supabase.auth.signOut()
  }

  if (statusLoading || loadState === 'loading') return <CenteredMessage text="Farkındalık paylaşımları yükleniyor…" />
  if (!hasActiveMembership) return <CenteredMessage text="Bu sayfaya erişim yetkin yok." />
  if (loadState === 'error') return <CenteredMessage text="Farkındalık paylaşımları yüklenirken bir hata oluştu." />

  const roleLabel = coordinatorRoleName ?? (isSuperAdmin ? 'Süper Yönetici' : 'Koordinatör')

  return (
    <AppShell isSuperAdmin={isSuperAdmin} displayName={displayName} roleLabel={roleLabel} onSignOut={() => void handleSignOut()}>
      <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
        <div className="grid gap-4 sm:flex sm:items-end sm:justify-between">
          <div>
            <p className="text-sm text-ink-soft">Aktif dönem: <span className="font-medium text-brand-dark">{periodLabel ?? 'Belirtilmedi'}</span></p>
            <h1 className="mt-1 text-3xl font-semibold tracking-tight text-ink">Farkındalık</h1>
            <p className="mt-1 max-w-2xl text-sm text-ink-soft">Farkındalık çalışmalarının hazırlık, tasarım ve paylaşım süreçlerini tek yerden takip et.</p>
          </div>
          <button type="button" onClick={openCreate} aria-expanded={formMode === 'create'} className="flex min-h-[44px] items-center justify-center gap-2 rounded-lg bg-accent px-5 text-sm font-semibold text-white shadow-card transition hover:brightness-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2">
            <PlusIcon /> Yeni farkındalık
          </button>
        </div>

        {successMessage ? <p role="status" className="mt-5 rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800">{successMessage}</p> : null}

        {canReviewAiSuggestions ? (
          <section ref={suggestionSectionRef} className="mt-5 scroll-mt-5 overflow-hidden rounded-2xl border border-brand/20 bg-gradient-to-br from-brand-soft/70 via-canvas-surface to-accent-soft/35 shadow-card">
            <div className="flex items-start gap-3 border-b border-brand/10 px-4 py-4 sm:px-5">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-brand text-white"><AwarenessIcon /></span>
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2"><h2 className="font-semibold text-ink">Eczacılık odaklı içerik fırsatları</h2><span className="rounded-full bg-white/80 px-2 py-0.5 text-[10px] font-semibold text-brand-dark">MUPİ taslağı</span></div>
                <p className="mt-1 text-xs leading-5 text-ink-soft">Kaynaklı önemli günler 60–120 gün önceden değerlendirilir. Taslaklar otomatik yayımlanmaz veya kaydedilmez.</p>
              </div>
            </div>
            <div className="p-4 sm:p-5">
              {suggestionsLoading ? <p className="text-sm text-ink-soft">Yaklaşan eczacılık ve sağlık günleri kontrol ediliyor…</p> : null}
              {suggestionError ? <p role="alert" className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{suggestionError}</p> : null}
              {!suggestionsLoading && !suggestionError && suggestions.length === 0 ? <p className="text-sm text-ink-soft">Şu anda hazırlığa alınması gereken yeni bir içerik fırsatı yok.</p> : null}
              {suggestions.length > 0 ? (
                <div className="grid gap-3 lg:grid-cols-2">
                  {suggestions.map((suggestion) => {
                    const payload = suggestion.payload
                    const requested = searchParams.get('suggestion') === suggestion.id
                    return (
                      <details key={suggestion.id} open={requested} className={`group rounded-xl border bg-white/90 p-4 ${requested ? 'border-brand ring-2 ring-brand/10' : 'border-canvas-border'}`}>
                        <summary className="cursor-pointer list-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand">
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0"><p className="text-xs font-semibold uppercase tracking-wide text-brand-dark">Hazırlığa başla: {formatDate(payload.suggested_preparation_date)}</p><h3 className="mt-1 break-words font-semibold text-ink">{payload.name}</h3><p className="mt-1 text-sm text-ink-soft">Paylaşım: {formatDate(payload.suggested_share_date || suggestion.targetDate)}</p></div>
                            <span className="shrink-0 rounded-full bg-brand-soft px-2 py-1 text-xs font-semibold text-brand-dark">Detay</span>
                          </div>
                          <p className="mt-3 text-sm leading-5 text-ink-soft">{payload.content_idea}</p>
                        </summary>
                        <div className="mt-4 grid gap-3 border-t border-canvas-border pt-4 text-sm">
                          <div><p className="font-semibold text-ink">Taslak metin</p><p className="mt-1 whitespace-pre-wrap leading-5 text-ink-soft">{payload.draft_text}</p></div>
                          <div><p className="font-semibold text-ink">Görsel fikri</p><p className="mt-1 leading-5 text-ink-soft">{payload.visual_idea}</p></div>
                          <div className="rounded-lg bg-brand-soft/70 p-3"><p className="font-semibold text-brand-dark">Neden MUPSA için uygun?</p><p className="mt-1 leading-5 text-ink-soft">{payload.pharmacy_relevance}</p></div>
                          <a href={payload.source_url} target="_blank" rel="noreferrer" className="w-fit font-semibold text-brand-dark hover:underline">Kaynak: {payload.source_name} ↗</a>
                          <div className="grid gap-2 min-[420px]:grid-cols-2">
                            <button type="button" onClick={() => transferSuggestionToForm(suggestion)} className="min-h-[44px] rounded-lg bg-brand px-4 text-sm font-semibold text-white hover:brightness-95">Farkındalık formuna aktar</button>
                            <button type="button" onClick={() => void dismissSuggestion(suggestion.id)} className="min-h-[44px] rounded-lg border border-canvas-border px-4 text-sm font-semibold text-ink-soft hover:bg-canvas">Bu yıl kullanma</button>
                          </div>
                        </div>
                      </details>
                    )
                  })}
                </div>
              ) : null}
            </div>
          </section>
        ) : null}

        <section className="mt-5 rounded-2xl border border-canvas-border bg-canvas-surface p-4 shadow-card sm:p-5">
          <div className="mb-4 flex items-center gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-brand-soft text-brand-dark"><FilterIcon /></span>
            <div><h2 className="font-semibold text-ink">Farkındalıkları filtrele</h2><p className="mt-0.5 text-xs text-ink-soft">Arama ve paylaşım durumuyla sonuçları daralt.</p></div>
          </div>
          <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_18rem_auto] md:items-end">
            <label className="grid gap-2">
              <span className="text-xs font-semibold uppercase tracking-wide text-ink-soft">Arama</span>
              <span className="relative block">
                <span className="pointer-events-none absolute inset-y-0 left-4 flex items-center text-brand-dark"><SearchIcon /></span>
                <input value={searchQuery} onChange={(event) => setSearchQuery(event.target.value)} placeholder="Farkındalık veya kapsam ara" className="min-h-[58px] w-full rounded-xl border border-canvas-border bg-canvas py-3 pl-12 pr-4 text-sm text-ink transition hover:border-brand/40 focus:bg-canvas-surface focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand" />
              </span>
            </label>
            <label className="grid gap-2">
              <span className="text-xs font-semibold uppercase tracking-wide text-ink-soft">Paylaşım durumu</span>
              <span className="relative block">
                <select value={listFilter} onChange={(event) => setListFilter(event.target.value as ListFilter)} className="min-h-[58px] w-full appearance-none rounded-xl border border-canvas-border bg-canvas px-4 py-3 pr-12 text-sm font-medium text-ink transition hover:border-brand/40 focus:bg-canvas-surface focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand">
                  <option value="all">Tüm paylaşımlar</option>
                  <option value="waiting">Paylaşım bekleyenler</option>
                  <option value="shared">Paylaşılanlar</option>
                  <option value="delayed">Gecikenler</option>
                </select>
                <span className="pointer-events-none absolute inset-y-0 right-4 flex items-center text-brand-dark"><SelectChevronIcon /></span>
              </span>
            </label>
            <label className="flex min-h-[58px] cursor-pointer items-center gap-3 rounded-xl border border-canvas-border bg-canvas px-4 text-sm font-medium text-ink-soft transition hover:border-brand/40">
              <input type="checkbox" checked={showInactive} onChange={(event) => setShowInactive(event.target.checked)} className="h-5 w-5 rounded accent-brand" />
              Pasifleri göster
            </label>
          </div>
        </section>

        <div className="mt-5 grid gap-4">
          {filteredPosts.length === 0 ? (
            <section className="rounded-xl border border-canvas-border bg-canvas-surface px-5 py-10 text-center shadow-card">
              <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-accent-soft text-amber-800"><EmptyAwarenessIcon /></span>
              <h2 className="mt-3 font-semibold text-ink">{posts.length === 0 ? 'Henüz farkındalık kaydı yok' : 'Aramana uygun kayıt bulunamadı'}</h2>
              <p className="mt-1 text-sm text-ink-soft">{posts.length === 0 ? 'İlk farkındalık çalışmasını oluşturarak başlayabilirsin.' : 'Arama metnini veya seçili filtreyi değiştirebilirsin.'}</p>
            </section>
          ) : filteredPosts.map((post) => {
            const canEdit = isSuperAdmin || (profileId !== null && (post.createdBy === profileId || post.designResponsibleId === profileId || post.pressResponsibleId === profileId))
            const delayed = isDelayed(post.shareDate, post.sharingStatus)
            const links = [
              { label: 'Drive klasörü', url: post.driveFolderUrl },
              { label: 'Tasarım', url: post.designUrl },
              { label: 'Paylaşım', url: post.shareUrl },
            ].filter((item): item is { label: string; url: string } => Boolean(item.url))

            return (
              <article key={post.id} className={`overflow-hidden rounded-2xl border bg-canvas-surface shadow-card ${post.deletedAt ? 'border-danger/25 opacity-75' : 'border-canvas-border'}`}>
                <div className="p-4 sm:p-5">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div className="flex min-w-0 gap-3">
                      <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-accent-soft text-amber-800"><AwarenessIcon /></span>
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-xs font-medium text-amber-800">{formatMonthYear(post.shareDate ?? post.startDate)}</span>
                          {post.deletedAt ? <span className="rounded-full border border-danger/20 bg-danger-soft px-2 py-0.5 text-xs font-medium text-danger">Pasif</span> : null}
                          {delayed ? <span className="rounded-full border border-danger/20 bg-danger-soft px-2 py-0.5 text-xs font-medium text-danger">Gecikti</span> : null}
                        </div>
                        <h2 className="mt-1 break-words text-lg font-semibold text-ink">{post.awarenessName}</h2>
                        {post.scope ? <p className="mt-1 break-words text-sm text-ink-soft">{post.scope}</p> : null}
                      </div>
                    </div>
                    <span className={`inline-flex min-h-9 w-full shrink-0 items-center justify-center rounded-lg border px-3 py-1 text-xs font-semibold sm:w-fit ${getStatusTone(post.sharingStatus)}`}>{getStatusLabel(post.sharingStatus, sharingStatuses)}</span>
                  </div>

                  <dl className="mt-5 grid gap-3 border-y border-canvas-border py-4 sm:grid-cols-2 xl:grid-cols-4">
                    {[
                      ['Hazırlık başlangıcı', post.preparationStartDate],
                      ['Tarih aralığı', post.startDate && post.endDate ? `${formatDate(post.startDate)} – ${formatDate(post.endDate)}` : post.startDate ?? post.endDate],
                      ['Tahmini paylaşım', post.estimatedDate],
                      ['Paylaşım tarihi', post.shareDate],
                    ].map(([label, value]) => (
                      <div key={label} className="flex items-start gap-2">
                        <span className="mt-0.5 shrink-0 text-brand-dark"><CalendarIcon /></span>
                        <div><dt className="text-xs text-ink-soft">{label}</dt><dd className="mt-0.5 text-sm font-medium text-ink">{label === 'Tarih aralığı' && value?.includes('–') ? value : formatDate(value)}</dd></div>
                      </div>
                    ))}
                  </dl>

                  <div className="mt-4 grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(16rem,.7fr)]">
                    <div className="rounded-xl border border-canvas-border bg-canvas p-3.5">
                      <p className="text-xs font-medium uppercase tracking-wide text-ink-soft">Süreç durumları</p>
                      <div className="mt-2 flex flex-wrap gap-2">
                        {[
                          ['Tasarım', post.designStatus, designStatuses],
                          ['Duyuru', post.announcementStatus, announcementStatuses],
                          ['Paylaşım', post.sharingStatus, sharingStatuses],
                          ['Kayıt kontrolü', post.recordCheckStatus, recordCheckStatuses],
                        ].map(([label, slug, options]) => (
                          <span key={label as string} className={`inline-flex rounded-full border px-2.5 py-1 text-xs ${getStatusTone(slug as string)}`}><span className="mr-1 font-medium">{label as string}:</span>{getStatusLabel(slug as string, options as StatusOption[])}</span>
                        ))}
                      </div>
                    </div>
                    <div className="rounded-xl border border-canvas-border bg-canvas p-3.5">
                      <p className="text-xs font-medium uppercase tracking-wide text-ink-soft">Sorumlular</p>
                      <div className="mt-2 grid gap-2 text-sm text-ink-soft">
                        <span className="flex items-center gap-2"><PersonIcon /><span><span className="font-medium text-ink">Tasarım:</span> {getProfileName(post.designResponsibleId)}</span></span>
                        <span className="flex items-center gap-2"><PersonIcon /><span><span className="font-medium text-ink">Basın Yayın:</span> {getProfileName(post.pressResponsibleId)}</span></span>
                        <span className="flex items-center gap-2"><PersonIcon /><span><span className="font-medium text-ink">Kaydı giren:</span> {getProfileName(post.createdBy)}</span></span>
                      </div>
                    </div>
                  </div>

                  {post.nextAction || post.note ? (
                    <div className="mt-4 grid gap-3 rounded-xl border border-canvas-border bg-canvas p-3.5 text-sm sm:grid-cols-2">
                      {post.nextAction ? <p className="text-ink-soft"><span className="font-medium text-ink">Sonraki aksiyon:</span> {post.nextAction}</p> : null}
                      {post.note ? <p className="whitespace-pre-wrap text-ink-soft"><span className="font-medium text-ink">Not:</span> {post.note}</p> : null}
                    </div>
                  ) : null}
                </div>

                {links.length > 0 || canEdit ? (
                  <footer className="flex flex-col gap-3 border-t border-canvas-border bg-canvas/50 px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-5">
                    <div className="grid grid-cols-1 gap-2 min-[390px]:grid-cols-2 sm:flex sm:flex-wrap">
                      {links.map((item) => <a key={item.label} href={item.url} target="_blank" rel="noreferrer" className="flex min-h-[44px] items-center justify-center gap-1.5 rounded-lg border border-canvas-border bg-canvas-surface px-3 text-sm font-semibold text-brand-dark hover:bg-brand-soft"><LinkIcon />{item.label}</a>)}
                    </div>
                    {canEdit ? (
                      <div className="grid grid-cols-1 gap-2 min-[390px]:grid-cols-2 sm:flex sm:flex-wrap sm:justify-end">
                        {!post.deletedAt ? <button type="button" onClick={() => openEdit(post)} className="min-h-[44px] rounded-lg border border-brand/40 bg-canvas-surface px-4 text-sm font-semibold text-brand-dark hover:bg-brand-soft">Düzenle</button> : null}
                        <button type="button" onClick={() => void toggleActive(post)} className={`min-h-[44px] rounded-lg border px-3 text-sm font-semibold ${post.deletedAt ? 'border-green-200 bg-green-50 text-green-700 hover:bg-green-100' : 'border-red-200 text-danger hover:bg-danger-soft'}`}>{post.deletedAt ? 'Yeniden aktifleştir' : 'Pasifleştir'}</button>
                        {isSuperAdmin && post.deletedAt ? <button type="button" onClick={() => { setSuccessMessage(null); setDeleteError(null); setDeleteTarget(post) }} className="min-h-[44px] rounded-lg border border-danger/25 px-3 text-sm font-semibold text-danger hover:bg-danger-soft">Kalıcı sil</button> : null}
                      </div>
                    ) : null}
                  </footer>
                ) : null}
              </article>
            )
          })}
        </div>
      </main>

      {formMode !== 'closed' ? (
        <>
          <button type="button" aria-label="Formu kapat" tabIndex={-1} onClick={() => !isSaving && setFormMode('closed')} className="fixed inset-0 z-40 hidden bg-ink/45 backdrop-blur-[1px] lg:block" />
          <section ref={panelRef} role="dialog" aria-modal="true" aria-labelledby="awareness-form-title" className="fixed inset-0 z-50 flex flex-col bg-canvas-surface shadow-2xl lg:left-auto lg:w-[min(52rem,calc(100vw-15rem))]" style={{ paddingTop: 'env(safe-area-inset-top)' }}>
            <header className="flex shrink-0 items-center justify-between gap-3 border-b border-canvas-border px-4 py-4 sm:px-6">
              <div className="flex min-w-0 items-center gap-3">
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-accent-soft text-amber-800"><AwarenessIcon /></span>
                <div className="min-w-0"><h2 id="awareness-form-title" className="truncate text-lg font-semibold text-ink">{formMode === 'create' ? 'Yeni farkındalık' : 'Farkındalığı düzenle'}</h2><p className="hidden text-xs text-ink-soft sm:block">Çalışmanın planlama ve paylaşım bilgilerini düzenle.</p></div>
              </div>
              <button ref={closeButtonRef} type="button" onClick={() => setFormMode('closed')} disabled={isSaving} aria-label="Formu kapat" className="flex min-h-[44px] shrink-0 items-center gap-2 rounded-lg border border-canvas-border px-3 text-sm font-medium text-ink-soft hover:bg-canvas hover:text-ink disabled:opacity-60"><span className="hidden sm:inline">Kapat</span><CloseIcon /></button>
            </header>

            <form onSubmit={(event) => { event.preventDefault(); void handleSave() }} className="flex min-h-0 flex-1 flex-col">
              <div className="flex-1 overflow-y-auto px-4 py-5 sm:px-6">
                <div className="grid gap-6">
                  <fieldset className="rounded-xl border border-canvas-border bg-canvas-surface p-4 sm:p-5"><legend className="px-1"><span className="flex items-center gap-2 text-sm font-semibold text-brand-dark"><span className="flex h-8 w-8 items-center justify-center rounded-lg bg-accent-soft text-amber-800"><AwarenessIcon /></span>Temel bilgiler</span></legend><div className="mt-3 grid gap-4 sm:grid-cols-2">
                    <label className="grid gap-1.5 text-sm font-medium text-ink sm:col-span-2">Farkındalık adı *<input value={awarenessName} onChange={(event) => setAwarenessName(event.target.value)} disabled={isSaving} placeholder="Örn. Sürdürülebilirlik Nedir?" className={fieldClass} /></label>
                    <label className="grid gap-1.5 text-sm font-medium text-ink sm:col-span-2">Kapsam<input value={scope} onChange={(event) => setScope(event.target.value)} disabled={isSaving} placeholder="Çalışmanın kısa kapsamı" className={fieldClass} /></label>
                  </div></fieldset>

                  <fieldset className="rounded-xl border border-canvas-border bg-canvas-surface p-4 sm:p-5"><legend className="px-1"><span className="flex items-center gap-2 text-sm font-semibold text-brand-dark"><span className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-soft"><CalendarIcon /></span>Tarihler</span></legend><div className="mt-3 grid gap-4 sm:grid-cols-2">
                    <label className="grid gap-1.5 text-sm font-medium text-ink">Başlangıç günü<input type="date" value={startDate} onChange={(event) => setStartDate(event.target.value)} disabled={isSaving} className={fieldClass} /></label>
                    <label className="grid gap-1.5 text-sm font-medium text-ink">Bitiş günü<input type="date" value={endDate} onChange={(event) => setEndDate(event.target.value)} disabled={isSaving} className={fieldClass} /></label>
                    <label className="grid gap-1.5 text-sm font-medium text-ink">Tahmini paylaşım<input type="date" value={estimatedDate} onChange={(event) => setEstimatedDate(event.target.value)} disabled={isSaving} className={fieldClass} /></label>
                    <label className="grid gap-1.5 text-sm font-medium text-ink">Paylaşım tarihi<input type="date" value={shareDate} onChange={(event) => setShareDate(event.target.value)} disabled={isSaving} className={fieldClass} /></label>
                    <label className="grid gap-1.5 text-sm font-medium text-ink">Hazırlık başlangıcı <span className="font-normal text-ink-soft">(isteğe bağlı)</span><input type="date" value={preparationStartDate} onChange={(event) => setPreparationStartDate(event.target.value)} disabled={isSaving} className={fieldClass} /></label>
                    <label className="grid gap-1.5 text-sm font-medium text-ink">Kapanış tarihi<input type="date" value={closingDate} onChange={(event) => setClosingDate(event.target.value)} disabled={isSaving} className={fieldClass} /></label>
                  </div></fieldset>

                  <fieldset className="rounded-xl border border-canvas-border bg-canvas-surface p-4 sm:p-5"><legend className="px-1"><span className="flex items-center gap-2 text-sm font-semibold text-brand-dark"><span className="flex h-8 w-8 items-center justify-center rounded-lg bg-accent-soft text-amber-800"><AwarenessIcon /></span>Süreç durumları</span></legend><div className="mt-3 grid gap-4 sm:grid-cols-2">
                    <label className="grid gap-1.5 text-sm font-medium text-ink">Tasarım durumu<select value={designStatus} onChange={(event) => setDesignStatus(event.target.value)} disabled={isSaving} className={fieldClass}>{designStatuses.map((option) => <option key={option.slug} value={option.slug}>{option.label}</option>)}</select></label>
                    <label className="grid gap-1.5 text-sm font-medium text-ink">Duyuru metni durumu<select value={announcementStatus} onChange={(event) => setAnnouncementStatus(event.target.value)} disabled={isSaving} className={fieldClass}>{announcementStatuses.map((option) => <option key={option.slug} value={option.slug}>{option.label}</option>)}</select></label>
                    <label className="grid gap-1.5 text-sm font-medium text-ink">Paylaşım durumu<select value={sharingStatus} onChange={(event) => setSharingStatus(event.target.value)} disabled={isSaving} className={fieldClass}>{sharingStatuses.map((option) => <option key={option.slug} value={option.slug}>{option.label}</option>)}</select></label>
                    <label className="grid gap-1.5 text-sm font-medium text-ink">Kayıt kontrolü<select value={recordCheckStatus} onChange={(event) => setRecordCheckStatus(event.target.value)} disabled={isSaving} className={fieldClass}>{recordCheckStatuses.map((option) => <option key={option.slug} value={option.slug}>{option.label}</option>)}</select></label>
                  </div></fieldset>

                  <fieldset className="rounded-xl border border-canvas-border bg-canvas-surface p-4 sm:p-5"><legend className="px-1"><span className="flex items-center gap-2 text-sm font-semibold text-brand-dark"><span className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-soft"><PersonIcon /></span>Sorumlular ve takip</span></legend><div className="mt-3 grid gap-4 sm:grid-cols-2">
                    <label className="grid gap-1.5 text-sm font-medium text-ink">Tasarım sorumlusu<select value={designResponsibleId} onChange={(event) => setDesignResponsibleId(event.target.value)} disabled={isSaving} className={fieldClass}><option value="">Seçiniz</option>{profiles.map((profile) => <option key={profile.id} value={profile.id}>{profile.name}</option>)}</select></label>
                    <label className="grid gap-1.5 text-sm font-medium text-ink">Basın Yayın sorumlusu<select value={pressResponsibleId} onChange={(event) => setPressResponsibleId(event.target.value)} disabled={isSaving} className={fieldClass}><option value="">Seçiniz</option>{profiles.map((profile) => <option key={profile.id} value={profile.id}>{profile.name}</option>)}</select></label>
                    <label className="grid gap-1.5 text-sm font-medium text-ink sm:col-span-2">Sonraki aksiyon<input value={nextAction} onChange={(event) => setNextAction(event.target.value)} disabled={isSaving} placeholder="Sıradaki yapılacak işi yazın" className={fieldClass} /></label>
                    <label className="grid gap-1.5 text-sm font-medium text-ink sm:col-span-2">Not<textarea value={note} onChange={(event) => setNote(event.target.value)} disabled={isSaving} rows={3} className={`${fieldClass} resize-y`} /></label>
                  </div></fieldset>

                  <fieldset className="rounded-xl border border-canvas-border bg-canvas-surface p-4 sm:p-5"><legend className="px-1"><span className="flex items-center gap-2 text-sm font-semibold text-brand-dark"><span className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-soft"><LinkIcon /></span>Bağlantılar</span></legend><div className="mt-3 grid gap-4 sm:grid-cols-2">
                    <label className="grid gap-1.5 text-sm font-medium text-ink">Drive klasörü<input type="url" value={driveFolderUrl} onChange={(event) => setDriveFolderUrl(event.target.value)} disabled={isSaving} placeholder="https://" className={fieldClass} /></label>
                    <label className="grid gap-1.5 text-sm font-medium text-ink">Tasarım linki<input type="url" value={designUrl} onChange={(event) => setDesignUrl(event.target.value)} disabled={isSaving} placeholder="https://" className={fieldClass} /></label>
                    <label className="grid gap-1.5 text-sm font-medium text-ink sm:col-span-2">Paylaşım linki<input type="url" value={shareUrl} onChange={(event) => setShareUrl(event.target.value)} disabled={isSaving} placeholder="https://" className={fieldClass} /></label>
                  </div></fieldset>
                </div>
                {formError ? <p role="alert" className="mt-5 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{formError}</p> : null}
              </div>
              <footer className="flex shrink-0 flex-col-reverse gap-2 border-t border-canvas-border bg-canvas-surface px-4 py-4 sm:flex-row sm:justify-end sm:px-6" style={{ paddingBottom: 'calc(1rem + env(safe-area-inset-bottom))' }}>
                <button type="button" onClick={() => setFormMode('closed')} disabled={isSaving} className="min-h-[44px] rounded-lg border border-canvas-border px-5 text-sm font-medium text-ink-soft disabled:opacity-60">İptal</button>
                <button type="submit" disabled={isSaving} className="min-h-[44px] rounded-lg bg-accent px-6 text-sm font-semibold text-white shadow-card disabled:opacity-60">{isSaving ? 'Kaydediliyor…' : formMode === 'create' ? 'Farkındalığı oluştur' : 'Değişiklikleri kaydet'}</button>
              </footer>
            </form>
          </section>
        </>
      ) : null}
      <PermanentDeleteDialog
        isOpen={deleteTarget !== null}
        title="Farkındalığı kalıcı olarak sil"
        itemName={deleteTarget?.awarenessName ?? ''}
        description="Farkındalık kaydı ve ona bağlı görevler, atamalar, bildirimler ve görev dosyaları kalıcı olarak silinecek."
        isDeleting={isDeleting}
        error={deleteError}
        onClose={closeDeleteDialog}
        onConfirm={() => void handlePermanentDelete()}
      />
    </AppShell>
  )
}
