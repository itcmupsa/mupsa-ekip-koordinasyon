export type AiOperation =
  | 'home_summary'
  | 'page_analysis'
  | 'chat'
  | 'draft'
  | 'calendar_classification'
  | 'awareness_suggestion'
  | 'deep_analysis'
  | 'calendar_deep_analysis'
  | 'weekly_management_analysis'
  | 'institutional_memory'
  | 'embedding'

export type AiClaimType = 'fact' | 'inference' | 'recommendation' | 'draft'

export interface AiModelSettings {
  flashModel: string
  flashLiteModel: string
  embeddingModel: string
}

export interface AiSourceDescriptor {
  alias: string
  entityType: string
  entityId: string
  title: string
}

export interface AiClaim {
  text: string
  type: AiClaimType
  sourceRefs: string[]
}

export interface AiResponseEnvelope {
  answer: string
  claims: AiClaim[]
}

export interface AiValidationResult {
  envelope: AiResponseEnvelope | null
  errors: string[]
}

export type HomeSummarySourceType = 'task' | 'event' | 'awareness' | 'calendar_entry'

export type HomeSummaryReasonCode =
  | 'task_created'
  | 'task_updated'
  | 'task_completed'
  | 'overdue_task'
  | 'due_soon_task'
  | 'high_priority_task'
  | 'assigned_open_task'
  | 'open_task'
  | 'event_created'
  | 'event_updated'
  | 'missing_event_field'
  | 'event_preparation_active'
  | 'event_final_days'
  | 'event_day'
  | 'event_report_due'
  | 'awareness_created'
  | 'awareness_updated'
  | 'missing_awareness_field'
  | 'awareness_preparation_active'
  | 'awareness_share_due_soon'
  | 'calendar_entry_created'
  | 'calendar_entry_updated'
  | 'upcoming_calendar_entry'

export type HomeSummaryAction =
  | 'open_task'
  | 'open_event'
  | 'open_awareness'
  | 'open_calendar'

export interface HomeSummarySource {
  alias: string
  entityType: HomeSummarySourceType
  entityId: string
  allowedReasonCodes: HomeSummaryReasonCode[]
}

export interface HomeSummaryItem {
  sourceRef: string
  reasonCode: HomeSummaryReasonCode
  recommendation: string
  action: HomeSummaryAction
}

export interface HomeSummaryPlan {
  intro: string
  items: HomeSummaryItem[]
}

export interface HomeSummaryValidationResult {
  plan: HomeSummaryPlan | null
  errors: string[]
}

const FLASH_OPERATIONS: ReadonlySet<AiOperation> = new Set([
  'home_summary',
  'page_analysis',
  'deep_analysis',
  'calendar_deep_analysis',
  'weekly_management_analysis',
  'institutional_memory',
])

const FLASH_LITE_OPERATIONS: ReadonlySet<AiOperation> = new Set([
  'chat',
  'draft',
  'calendar_classification',
  'awareness_suggestion',
])

export function modelForOperation(settings: AiModelSettings, operation: AiOperation): string {
  if (operation === 'embedding') return settings.embeddingModel
  if (FLASH_OPERATIONS.has(operation)) return settings.flashModel
  if (FLASH_LITE_OPERATIONS.has(operation)) return settings.flashLiteModel
  throw new Error('Desteklenmeyen AI işlemi.')
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function isClaimType(value: unknown): value is AiClaimType {
  return value === 'fact' || value === 'inference' || value === 'recommendation' || value === 'draft'
}

function parseSourceRefs(value: unknown): string[] | null {
  if (!Array.isArray(value) || !value.every((item) => typeof item === 'string')) return null
  return value
}

export function validateAiResponse(
  value: unknown,
  allowedSources: AiSourceDescriptor[],
): AiValidationResult {
  const errors: string[] = []
  if (!isRecord(value)) return { envelope: null, errors: ['AI cevabı nesne biçiminde değil.'] }

  const answer = value.answer
  const rawClaims = value.claims
  if (typeof answer !== 'string' || answer.trim().length === 0) {
    errors.push('AI cevabında geçerli answer alanı yok.')
  }
  if (!Array.isArray(rawClaims)) errors.push('AI cevabında claims dizisi yok.')
  if (errors.length > 0) return { envelope: null, errors }

  const allowedAliases = new Set(allowedSources.map((source) => source.alias))
  const claims: AiClaim[] = []

  for (const [index, rawClaim] of (rawClaims as unknown[]).entries()) {
    if (!isRecord(rawClaim)) {
      errors.push(`İddia ${index + 1} nesne biçiminde değil.`)
      continue
    }

    const text = rawClaim.text
    const type = rawClaim.type
    const sourceRefs = parseSourceRefs(rawClaim.source_refs)
    if (typeof text !== 'string' || text.trim().length === 0 || !isClaimType(type) || !sourceRefs) {
      errors.push(`İddia ${index + 1} gerekli alanları taşımıyor.`)
      continue
    }

    const unknownSources = sourceRefs.filter((sourceRef) => !allowedAliases.has(sourceRef))
    if (unknownSources.length > 0) {
      errors.push(`İddia ${index + 1} izin verilmeyen kaynak kullanıyor.`)
      continue
    }

    if (type !== 'draft' && sourceRefs.length === 0) {
      errors.push(`İddia ${index + 1} kaynak göstermiyor.`)
      continue
    }

    claims.push({ text: text.trim(), type, sourceRefs })
  }

  return {
    envelope: {
      answer: (answer as string).trim(),
      claims,
    },
    errors,
  }
}

export function sourceAliasesAreSafe(sources: AiSourceDescriptor[]): boolean {
  const aliases = sources.map((source) => source.alias)
  return aliases.length === new Set(aliases).size
    && aliases.every((alias) => /^S[1-9][0-9]*$/.test(alias))
}

const HOME_REASON_TYPES: Record<HomeSummaryReasonCode, HomeSummarySourceType> = {
  task_created: 'task',
  task_updated: 'task',
  task_completed: 'task',
  overdue_task: 'task',
  due_soon_task: 'task',
  high_priority_task: 'task',
  assigned_open_task: 'task',
  open_task: 'task',
  event_created: 'event',
  event_updated: 'event',
  missing_event_field: 'event',
  event_preparation_active: 'event',
  event_final_days: 'event',
  event_day: 'event',
  event_report_due: 'event',
  awareness_created: 'awareness',
  awareness_updated: 'awareness',
  missing_awareness_field: 'awareness',
  awareness_preparation_active: 'awareness',
  awareness_share_due_soon: 'awareness',
  calendar_entry_created: 'calendar_entry',
  calendar_entry_updated: 'calendar_entry',
  upcoming_calendar_entry: 'calendar_entry',
}

const HOME_ACTION_TYPES: Record<HomeSummaryAction, HomeSummarySourceType> = {
  open_task: 'task',
  open_event: 'event',
  open_awareness: 'awareness',
  open_calendar: 'calendar_entry',
}

function isHomeReasonCode(value: unknown): value is HomeSummaryReasonCode {
  return typeof value === 'string' && value in HOME_REASON_TYPES
}

function isHomeAction(value: unknown): value is HomeSummaryAction {
  return typeof value === 'string' && value in HOME_ACTION_TYPES
}

export function validateHomeSummaryPlan(
  value: unknown,
  allowedSources: HomeSummarySource[],
): HomeSummaryValidationResult {
  if (!isRecord(value)) return { plan: null, errors: ['Ana sayfa özeti nesne biçiminde değil.'] }

  const errors: string[] = []
  const intro = value.intro
  const rawItems = value.items
  if (typeof intro !== 'string' || intro.trim().length === 0 || intro.length > 240) {
    errors.push('Ana sayfa özetinde geçerli intro alanı yok.')
  }
  if (!Array.isArray(rawItems) || rawItems.length > 3) {
    errors.push('Ana sayfa özeti en fazla 3 maddelik items dizisi taşımalıdır.')
  }
  if (errors.length > 0) return { plan: null, errors }

  const sourceByAlias = new Map(allowedSources.map((source) => [source.alias, source]))
  const seenSources = new Set<string>()
  const items: HomeSummaryItem[] = []

  for (const [index, rawItem] of (rawItems as unknown[]).entries()) {
    if (!isRecord(rawItem)) {
      errors.push(`Özet maddesi ${index + 1} nesne biçiminde değil.`)
      continue
    }

    const sourceRef = rawItem.source_ref
    const reasonCode = rawItem.reason_code
    const recommendation = rawItem.recommendation
    const action = rawItem.action
    if (
      typeof sourceRef !== 'string'
      || !isHomeReasonCode(reasonCode)
      || typeof recommendation !== 'string'
      || recommendation.trim().length === 0
      || recommendation.length > 280
      || !isHomeAction(action)
    ) {
      errors.push(`Özet maddesi ${index + 1} gerekli alanları taşımıyor.`)
      continue
    }

    const source = sourceByAlias.get(sourceRef)
    if (!source) {
      errors.push(`Özet maddesi ${index + 1} izin verilmeyen kaynak kullanıyor.`)
      continue
    }
    if (seenSources.has(sourceRef)) {
      errors.push(`Özet maddesi ${index + 1} aynı kaynağı tekrar ediyor.`)
      continue
    }
    if (HOME_REASON_TYPES[reasonCode] !== source.entityType) {
      errors.push(`Özet maddesi ${index + 1} kaynak türüyle uyuşmayan neden kullanıyor.`)
      continue
    }
    if (!source.allowedReasonCodes.includes(reasonCode)) {
      errors.push(`Özet maddesi ${index + 1} kaynak verisiyle doğrulanamayan neden kullanıyor.`)
      continue
    }
    if (HOME_ACTION_TYPES[action] !== source.entityType) {
      errors.push(`Özet maddesi ${index + 1} kaynak türüyle uyuşmayan eylem kullanıyor.`)
      continue
    }

    seenSources.add(sourceRef)
    items.push({ sourceRef, reasonCode, recommendation: recommendation.trim(), action })
  }

  if (errors.length > 0) return { plan: null, errors }
  return { plan: { intro: (intro as string).trim(), items }, errors: [] }
}
