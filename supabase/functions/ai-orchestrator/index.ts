import { serve } from 'https://deno.land/std@0.192.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0'
import {
  modelForOperation,
  validateHomeSummaryPlan,
  type HomeSummaryAction,
  type HomeSummaryReasonCode,
  type HomeSummarySource,
  type HomeSummarySourceType,
} from '../_shared/aiCore.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface AiRequest {
  operation?: 'status' | 'home_summary' | 'calendar_classification'
  force?: boolean
  calendar_entry_id?: string
}

type CalendarClassification = 'club_meeting' | 'academic_period' | 'exam_period' | 'holiday' | 'governance' | 'multi_day_program' | 'not_global'

interface CalendarEntryRecord {
  id: string
  period_id: string
  title: string
  entry_type: 'academic' | 'official' | 'meeting' | 'other'
  start_date: string
  end_date: string | null
  note: string | null
}

interface CalendarClassificationResult {
  source_id: string
  classification: CalendarClassification
  should_notify: boolean
  confidence: number
  event_time: string | null
}

interface MembershipRecord {
  period_id: string
  app_role: 'super_admin' | 'coordinator'
  coordinator_role_id: string
}

interface AiSettingRecord {
  is_enabled: boolean
  free_tier_only: boolean
  flash_model: string
  flash_lite_model: string
  embedding_model: string
  policy_version: string
}

interface HomeContextItem {
  source_type: HomeSummarySourceType
  source_id: string
  title: string
  route: string
  [key: string]: unknown
}

interface HomeContext {
  schema_version: string
  generated_at: string
  today: string
  period_id: string
  viewer: { app_role: string; coordinator_role: string }
  policy: Record<string, unknown>
  metrics: Record<string, number>
  tasks: HomeContextItem[]
  events: HomeContextItem[]
  awareness: HomeContextItem[]
  calendar: HomeContextItem[]
  activity: HomeContextItem[]
}

interface PreparedHomeSource extends HomeSummarySource {
  title: string
  route: string
  facts: Record<string, unknown>
}

interface GeminiResponse {
  candidates?: Array<{
    finishReason?: string
    content?: { parts?: Array<{ text?: string; thought?: boolean }> }
  }>
  usageMetadata?: { promptTokenCount?: number; candidatesTokenCount?: number }
}

class HttpError extends Error {
  constructor(public status: number, message: string) {
    super(message)
  }
}

function jsonResponse(body: Record<string, unknown>, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

const CALENDAR_CLASSIFICATIONS: CalendarClassification[] = [
  'club_meeting', 'academic_period', 'exam_period', 'holiday',
  'governance', 'multi_day_program', 'not_global',
]

function sanitizeCalendarText(value: string | null): string | null {
  if (!value) return null
  return value
    .replace(/[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}/g, '[e-posta kaldırıldı]')
    .replace(/https?:\/\/\S+/gi, '[bağlantı kaldırıldı]')
    .replace(/\+?\d[\d\s().-]{8,}\d/g, '[telefon kaldırıldı]')
    .slice(0, 500)
}

function deterministicCalendarClassification(entry: CalendarEntryRecord): CalendarClassificationResult {
  const text = `${entry.title} ${entry.note ?? ''}`.toLocaleLowerCase('tr-TR')
  let classification: CalendarClassification = 'not_global'
  if (/vize|final|bütünleme|sınav haft/.test(text)) classification = 'exam_period'
  else if (/bayram|yılbaşı|cumhuriyet|atatürk|zafer|resm[iî] tatil/.test(text)) classification = 'holiday'
  else if (/genel kurul|seçim|devir teslim|yönetim kurulu|yk buluş|yk toplant/.test(text)) classification = 'governance'
  else if (entry.entry_type === 'meeting' || /toplantı|buluşma/.test(text)) classification = 'club_meeting'
  else if (/ders başlang|dönem başlang|akademik dönem/.test(text)) classification = 'academic_period'
  else if (entry.end_date && entry.end_date > entry.start_date && /kongre|sempozyum|kamp|program|zirve/.test(text)) classification = 'multi_day_program'
  const timeMatch = text.match(/(?:saat\s*)?(?:^|\s)([01]?\d|2[0-3])[.:]([0-5]\d)(?:\s|$)/)
  return {
    source_id: entry.id,
    classification,
    should_notify: classification !== 'not_global',
    confidence: classification === 'not_global' ? 0.45 : 0.75,
    event_time: timeMatch ? `${timeMatch[1].padStart(2, '0')}:${timeMatch[2]}` : null,
  }
}

function validateCalendarClassifications(value: unknown, entries: CalendarEntryRecord[]): CalendarClassificationResult[] {
  if (!isRecord(value) || !Array.isArray(value.items)) return entries.map(deterministicCalendarClassification)
  const entryIds = new Set(entries.map((entry) => entry.id))
  const resolved = new Map<string, CalendarClassificationResult>()
  for (const raw of value.items) {
    if (!isRecord(raw) || typeof raw.source_id !== 'string' || !entryIds.has(raw.source_id)) continue
    const classification = raw.classification as CalendarClassification
    if (!CALENDAR_CLASSIFICATIONS.includes(classification)) continue
    const eventTime = typeof raw.event_time === 'string' && /^([01]\d|2[0-3]):[0-5]\d$/.test(raw.event_time)
      ? raw.event_time
      : null
    resolved.set(raw.source_id, {
      source_id: raw.source_id,
      classification,
      should_notify: raw.should_notify === true && classification !== 'not_global',
      confidence: typeof raw.confidence === 'number' ? Math.max(0, Math.min(1, raw.confidence)) : 0.5,
      event_time: eventTime,
    })
  }
  return entries.map((entry) => resolved.get(entry.id) ?? deterministicCalendarClassification(entry))
}

function asItems(value: unknown): HomeContextItem[] {
  if (!Array.isArray(value)) return []
  return value.filter((item): item is HomeContextItem =>
    isRecord(item)
    && typeof item.source_type === 'string'
    && typeof item.source_id === 'string'
    && typeof item.title === 'string'
    && typeof item.route === 'string'
  )
}

function normalizeHomeContext(value: unknown): HomeContext {
  if (!isRecord(value)) throw new HttpError(500, 'AI bağlamı geçerli biçimde üretilemedi.')
  return {
    schema_version: String(value.schema_version ?? ''),
    generated_at: String(value.generated_at ?? ''),
    today: String(value.today ?? ''),
    period_id: String(value.period_id ?? ''),
    viewer: isRecord(value.viewer)
      ? { app_role: String(value.viewer.app_role ?? ''), coordinator_role: String(value.viewer.coordinator_role ?? '') }
      : { app_role: '', coordinator_role: '' },
    policy: isRecord(value.policy) ? value.policy : {},
    metrics: isRecord(value.metrics) ? value.metrics as Record<string, number> : {},
    tasks: asItems(value.tasks),
    events: asItems(value.events),
    awareness: asItems(value.awareness),
    calendar: asItems(value.calendar),
    activity: asItems(value.activity),
  }
}

function numberValue(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null
}

function dateHasStarted(value: unknown): boolean {
  if (typeof value !== 'string') return false
  const date = Date.parse(value)
  return Number.isFinite(date) && date <= Date.now()
}

function allowedReasons(item: HomeContextItem): HomeSummaryReasonCode[] {
  const reasons: HomeSummaryReasonCode[] = []
  if (typeof item.activity_kind === 'string') {
    const activityReason = item.activity_kind as HomeSummaryReasonCode
    const knownActivityReasons: HomeSummaryReasonCode[] = [
      'task_created', 'task_updated', 'task_completed',
      'event_created', 'event_updated',
      'awareness_created', 'awareness_updated',
      'calendar_entry_created', 'calendar_entry_updated',
    ]
    if (knownActivityReasons.includes(activityReason)) reasons.push(activityReason)
  }
  if (item.source_type === 'task') {
    if (item.is_overdue === true) reasons.push('overdue_task')
    const deadline = typeof item.deadline_at === 'string' ? Date.parse(item.deadline_at) : Number.NaN
    if (!item.is_overdue && Number.isFinite(deadline) && deadline <= Date.now() + 3 * 86_400_000) {
      reasons.push('due_soon_task')
    }
    if (item.priority === 'high' || item.priority === 'urgent') reasons.push('high_priority_task')
  }
  if (item.source_type === 'event') {
    const activePreparationPhase = item.lifecycle_phase === 'preparation'
      || item.lifecycle_phase === 'final_days'
      || item.lifecycle_phase === 'event_day'
    if (activePreparationPhase && Array.isArray(item.missing_fields) && item.missing_fields.length > 0) {
      reasons.push('missing_event_field')
    }
    if (item.lifecycle_phase === 'final_days') reasons.push('event_final_days')
    if (item.lifecycle_phase === 'event_day') reasons.push('event_day')
    if (item.lifecycle_phase === 'report_due') reasons.push('event_report_due')
  }
  if (item.source_type === 'awareness') {
    const daysUntilShare = numberValue(item.days_until_share)
    const preparationStarted = dateHasStarted(item.preparation_start_date)
    if (
      preparationStarted
      && daysUntilShare !== null
      && daysUntilShare >= 0
      && Array.isArray(item.missing_fields)
      && item.missing_fields.length > 0
    ) reasons.push('missing_awareness_field')
    if (daysUntilShare !== null && daysUntilShare >= 0 && daysUntilShare <= 7) {
      reasons.push('awareness_share_due_soon')
    }
  }
  if (item.source_type === 'calendar_entry') {
    const daysUntil = numberValue(item.days_until)
    if (daysUntil !== null && daysUntil >= 0 && daysUntil <= 14) reasons.push('upcoming_calendar_entry')
  }
  return [...new Set(reasons)]
}

const REASON_PRIORITY: Record<HomeSummaryReasonCode, number> = {
  task_completed: 104,
  task_created: 94,
  task_updated: 82,
  overdue_task: 100,
  event_day: 98,
  due_soon_task: 95,
  awareness_share_due_soon: 92,
  upcoming_calendar_entry: 90,
  event_final_days: 88,
  high_priority_task: 85,
  missing_event_field: 80,
  missing_awareness_field: 78,
  assigned_open_task: 70,
  event_report_due: 68,
  event_preparation_active: 60,
  awareness_preparation_active: 58,
  open_task: 50,
  event_created: 93,
  event_updated: 81,
  awareness_created: 91,
  awareness_updated: 79,
  calendar_entry_created: 89,
  calendar_entry_updated: 77,
}

function sourcePriority(source: PreparedHomeSource): number {
  const reasonScore = Math.max(...source.allowedReasonCodes.map((reason) => REASON_PRIORITY[reason]), 0)
  const daysUntil = numberValue(source.facts.days_until)
    ?? numberValue(source.facts.days_until_event)
    ?? numberValue(source.facts.days_until_share)
  const proximityBonus = daysUntil !== null && daysUntil >= 0 ? Math.max(0, 14 - Math.min(daysUntil, 14)) : 0
  return reasonScore + proximityBonus
}

function previousReasonMap(payload: unknown): Map<string, string> {
  if (!isRecord(payload) || !Array.isArray(payload.items)) return new Map()
  const result = new Map<string, string>()
  for (const item of payload.items) {
    if (!isRecord(item) || typeof item.source_type !== 'string' || typeof item.source_id !== 'string' || typeof item.reason_code !== 'string') continue
    result.set(`${item.source_type}:${item.source_id}`, item.reason_code)
  }
  return result
}

function prepareHomeSources(context: HomeContext, previousPayload?: unknown): PreparedHomeSource[] {
  const currentCandidates = [
    ...context.tasks.slice(0, 12),
    ...context.events.slice(0, 8),
    ...context.awareness.slice(0, 8),
    ...context.calendar.slice(0, 8),
  ]
  const candidateByEntity = new Map<string, HomeContextItem>()
  for (const item of currentCandidates) candidateByEntity.set(`${item.source_type}:${item.source_id}`, item)
  for (const activity of context.activity.slice(0, 20)) {
    const key = `${activity.source_type}:${activity.source_id}`
    candidateByEntity.set(key, { ...(candidateByEntity.get(key) ?? {}), ...activity } as HomeContextItem)
  }
  const previousReasons = previousReasonMap(previousPayload)
  return [...candidateByEntity.values()]
    .map((item, index) => ({
      alias: `S${index + 1}`,
      entityType: item.source_type,
      entityId: item.source_id,
      allowedReasonCodes: allowedReasons(item),
      title: item.title,
      route: item.route,
      facts: Object.fromEntries(
        Object.entries(item).filter(([key]) => !['source_type', 'source_id', 'title', 'route'].includes(key)),
      ),
    }))
    .filter((source) => source.allowedReasonCodes.length > 0)
    .sort((left, right) => sourcePriority(right) - sourcePriority(left))
    .filter((source) => {
      if (typeof source.facts.activity_kind === 'string') return true
      return previousReasons.get(`${source.entityType}:${source.entityId}`) !== primaryReason(source)
    })
    .slice(0, 18)
    .map((source, index) => ({ ...source, alias: `S${index + 1}` }))
}

function buildDailyIntro(items: Array<{ title: string; reason_code: HomeSummaryReasonCode }>): string {
  if (items.length === 0) return 'Bugün için yeni bir ekip hareketi veya kritik durum bulunmuyor.'
  const completedCount = items.filter((item) => item.reason_code === 'task_completed').length
  const activityCount = items.filter((item) => [
    'task_created', 'task_updated', 'task_completed', 'event_created', 'event_updated',
    'awareness_created', 'awareness_updated', 'calendar_entry_created', 'calendar_entry_updated',
  ].includes(item.reason_code)).length
  if (completedCount > 0 && activityCount === completedCount) return `${completedCount} görev tamamlandı; yeni bir kritik durum görünmüyor.`
  if (activityCount > 0) return `Bugün kulüpte ${activityCount} ekip hareketi öne çıkıyor.`
  return `Bugün dikkat edilmesi gereken ${items.length} yakın tarihli konu var.`
}

const SOURCE_ACTIONS: Record<HomeSummarySourceType, HomeSummaryAction> = {
  task: 'open_task',
  event: 'open_event',
  awareness: 'open_awareness',
  calendar_entry: 'open_calendar',
}

const FIELD_LABELS: Record<string, string> = {
  venue: 'mekân',
  sks_status: 'SKS durumu',
  share_date: 'paylaşım tarihi',
  design_responsible: 'tasarım sorumlusu',
  publication_responsible: 'basın-yayın sorumlusu',
}

function primaryReason(source: PreparedHomeSource): HomeSummaryReasonCode {
  return [...source.allowedReasonCodes]
    .sort((left, right) => REASON_PRIORITY[right] - REASON_PRIORITY[left])[0]
}

function missingFieldText(source: PreparedHomeSource): string {
  const fields = Array.isArray(source.facts.missing_fields)
    ? source.facts.missing_fields.filter((field): field is string => typeof field === 'string')
    : []
  return fields.map((field) => FIELD_LABELS[field] ?? field).join(', ')
}

function ruleBasedRecommendation(source: PreparedHomeSource, reason: HomeSummaryReasonCode): string {
  const missingFields = missingFieldText(source)
  switch (reason) {
    case 'task_created': return 'Ekip için yeni bir görev oluşturuldu.'
    case 'task_updated': return 'Görev kaydının güncel durumu değiştirildi.'
    case 'task_completed': return 'Görev ekip tarafından tamamlandı.'
    case 'overdue_task': return 'Son tarihi geçen görevin güncel durumunu kontrol edin.'
    case 'due_soon_task': return 'Son tarihi yaklaşan görevin güncel durumunu kontrol edin.'
    case 'high_priority_task': return 'Yüksek öncelikli görevin güncel durumunu kontrol edin.'
    case 'assigned_open_task': return 'Size atanmış açık görevin durumunu kontrol edin.'
    case 'open_task': return 'Açık görevin durumunu kontrol edin.'
    case 'event_created': return 'Yeni etkinlik kaydı oluşturuldu.'
    case 'event_updated': return 'Etkinliğin güncel bilgileri değiştirildi.'
    case 'missing_event_field': return missingFields
      ? `Hazırlık dönemi başlayan etkinlikte eksik görünen alanları kontrol edin: ${missingFields}.`
      : 'Hazırlık dönemi başlayan etkinliğin eksik bilgilerini kontrol edin.'
    case 'event_preparation_active': return 'Hazırlık dönemi başlayan etkinliğin güncel bilgilerini kontrol edin.'
    case 'event_final_days': return 'Etkinliğe az kaldığı için güncel bilgileri kontrol edin.'
    case 'event_day': return 'Bugünkü etkinlik kaydını kontrol edin.'
    case 'event_report_due': return 'Etkinlik sonrasındaki rapor durumunu kontrol edin.'
    case 'awareness_created': return 'Yeni farkındalık çalışması oluşturuldu.'
    case 'awareness_updated': return 'Farkındalık çalışmasının güncel durumu değiştirildi.'
    case 'missing_awareness_field': return missingFields
      ? `Hazırlık dönemi başlayan farkındalık kaydında eksik görünen alanları kontrol edin: ${missingFields}.`
      : 'Hazırlık dönemi başlayan farkındalık kaydının eksik bilgilerini kontrol edin.'
    case 'awareness_preparation_active': return 'Paylaşım hazırlığı başlayan farkındalık kaydını kontrol edin.'
    case 'awareness_share_due_soon': return 'Paylaşım tarihi yaklaşan farkındalık kaydını kontrol edin.'
    case 'calendar_entry_created': return 'Takvime yeni bir kayıt eklendi.'
    case 'calendar_entry_updated': return 'Takvim kaydının bilgileri güncellendi.'
    case 'upcoming_calendar_entry': return 'Yaklaşan takvim kaydının tarih ve açıklama bilgilerini kontrol edin.'
  }
}

function buildRuleBasedPayload(sources: PreparedHomeSource[]) {
  const resolvedItems = sources.slice(0, 3).map((source) => {
    const reason = primaryReason(source)
    return {
      source_ref: source.alias,
      source_type: source.entityType,
      source_id: source.entityId,
      title: source.title,
      reason_code: reason,
      recommendation: ruleBasedRecommendation(source, reason),
      action: SOURCE_ACTIONS[source.entityType],
      route: source.route,
    }
  })
  return { intro: buildDailyIntro(resolvedItems), items: resolvedItems }
}

function parseGeminiJson(parts: Array<{ text?: string; thought?: boolean }>): unknown {
  const finalTexts = parts
    .filter((part) => part.thought !== true && typeof part.text === 'string' && part.text.trim())
    .map((part) => part.text!.trim())
  const candidates = [...finalTexts].reverse()
  if (finalTexts.length > 1) candidates.push(finalTexts.join(''))

  for (const candidate of candidates) {
    const normalized = candidate
      .replace(/^```(?:json)?\s*/i, '')
      .replace(/\s*```$/i, '')
      .trim()
    try {
      return JSON.parse(normalized)
    } catch {
      // Bir sonraki nihai metin parçasını dene; semantik doğrulama ayrıca uygulanır.
    }
  }
  throw new HttpError(502, 'Gemini cevabı JSON olarak ayrıştırılamadı.')
}

async function sha256(value: string): Promise<string> {
  const bytes = new TextEncoder().encode(value)
  const digest = await crypto.subtle.digest('SHA-256', bytes)
  return Array.from(new Uint8Array(digest)).map((byte) => byte.toString(16).padStart(2, '0')).join('')
}

async function callGemini(
  apiKeys: string[],
  model: string,
  context: HomeContext,
  sources: PreparedHomeSource[],
): Promise<{ value: unknown; inputTokens: number; outputTokens: number }> {
  const requestBody = JSON.stringify({
        systemInstruction: {
          parts: [{
            text: [
              'Sen MUPSA ekip koordinasyon uygulamasının salt-okunur çalışma danışmanısın.',
              'Yalnızca verilen kaynakları seç. Yeni gerçek, sayı, neden-sonuç veya kurum kuralı üretme.',
              'Her maddede tam bir source_ref, o kaynak için allowed_reason_codes içinden bir reason_code ve kaynak türüne uygun action kullan.',
              'Recommendation yalnızca kısa bir öneridir; kayıt oluşturma, silme, atama, bildirim gönderme veya durum değiştirme talimatı verme.',
              'Etkinlik raporunu yalnızca event_report_due nedeni sunulmuşsa öner.',
              'Bugün kulübün güncel durumunu özetle; yalnızca gerçekten bugün veya yakın zamanda işlem gerektiren kaynakları seç.',
              'Hazırlık döneminin başlamasını tek başına tekrar eden bir öneriye dönüştürme. Sırf alanı boş diye uzak tarihli kaydı seçme.',
              'Intro kısa olsun; uygulama tarafından ayrıca kesin verilerle yeniden oluşturulacaktır.',
              'En yararlı en fazla 3 maddeyi seç. Her öneri tek kısa cümle olsun ve aynı türden benzer uyarılarla listeyi doldurma.',
            ].join('\n'),
          }],
        },
        contents: [{
          role: 'user',
          parts: [{
            text: JSON.stringify({
              today: context.today,
              viewer: context.viewer,
              policy: context.policy,
              metrics: context.metrics,
              sources: sources.map((source) => ({
                source_ref: source.alias,
                source_type: source.entityType,
                title: source.title,
                allowed_reason_codes: source.allowedReasonCodes,
                facts: source.facts,
              })),
            }),
          }],
        }],
        generationConfig: {
          maxOutputTokens: 600,
          thinkingConfig: { thinkingLevel: 'LOW' },
          responseFormat: {
            text: {
              mimeType: 'APPLICATION_JSON',
              schema: {
                type: 'object',
                required: ['intro', 'items'],
                properties: {
                  intro: { type: 'string', maxLength: 240 },
                  items: {
                    type: 'array',
                    maxItems: 3,
                    items: {
                      type: 'object',
                      required: ['source_ref', 'reason_code', 'recommendation', 'action'],
                      properties: {
                        source_ref: { type: 'string' },
                        reason_code: { type: 'string' },
                        recommendation: { type: 'string', maxLength: 280 },
                        action: { type: 'string', enum: ['open_task', 'open_event', 'open_awareness', 'open_calendar'] },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      })

  for (const [keyIndex, apiKey] of apiKeys.entries()) {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
        body: requestBody,
      },
    )

    if (response.ok) {
      const data = await response.json() as GeminiResponse
      const parts = data.candidates?.[0]?.content?.parts ?? []
      if (parts.length === 0) throw new HttpError(502, 'Gemini boş bir cevap döndürdü.')
      const value = parseGeminiJson(parts)
      return {
        value,
        inputTokens: data.usageMetadata?.promptTokenCount ?? 0,
        outputTokens: data.usageMetadata?.candidatesTokenCount ?? 0,
      }
    }

    const errorBody = await response.text()
    const canTrySecondary = keyIndex < apiKeys.length - 1
      && [401, 403, 429, 500, 502, 503, 504].includes(response.status)
    if (canTrySecondary) {
      console.warn('Primary Gemini key unavailable; trying secondary key', response.status)
      continue
    }
    const errorMessage = response.status === 429
      ? 'Gemini ücretsiz kotası şu anda dolu.'
      : 'Gemini isteği başarısız oldu.'
    console.error('Gemini request failed', response.status, errorBody.slice(0, 300))
    throw new HttpError(response.status === 429 ? 429 : 502, errorMessage)
  }
  throw new HttpError(503, 'Gemini API anahtarı yapılandırılmadı.')
}

async function callGeminiCalendarClassifier(
  apiKeys: string[],
  model: string,
  entries: CalendarEntryRecord[],
): Promise<{ value: unknown; inputTokens: number; outputTokens: number }> {
  const requestBody = JSON.stringify({
    systemInstruction: {
      parts: [{
        text: [
          'MUPSA kulüp takvimine elle girilen kayıtları sınıflandır.',
          'Bildirim gönderilecekse alıcılar sistem tarafından tüm aktif üyelerdir; alıcı seçme.',
          'Kulüp toplantıları/yönetim kurulu buluşmaları, dönem-sınav haftaları, bayram ve resmî günler, genel kurul-seçim-devir teslim duyuruları ve çok günlük ortak programlar global olabilir.',
          'SKS evrakı, sponsor araması, başvuru işi, kişisel iş, görev niteliğindeki operasyon veya belirsiz/test kaydı global değildir.',
          'Aynı programın birden çok günü ayrı satırsa yalnızca ilk başlangıç kaydını bildirilecek kabul et.',
          'Metinde açık saat varsa HH:MM biçiminde çıkar; yoksa null döndür.',
          'Yalnızca verilen kimlikleri kullan ve her kaynak için tam bir sonuç döndür.',
        ].join('\n'),
      }],
    },
    contents: [{
      role: 'user',
      parts: [{
        text: JSON.stringify(entries.map((entry) => ({
          source_id: entry.id,
          title: entry.title,
          entry_type: entry.entry_type,
          start_date: entry.start_date,
          end_date: entry.end_date,
          note: sanitizeCalendarText(entry.note),
        }))),
      }],
    }],
    generationConfig: {
      maxOutputTokens: 900,
      thinkingConfig: { thinkingLevel: 'LOW' },
      responseFormat: {
        text: {
          mimeType: 'APPLICATION_JSON',
          schema: {
            type: 'object',
            required: ['items'],
            properties: {
              items: {
                type: 'array',
                items: {
                  type: 'object',
                  required: ['source_id', 'classification', 'should_notify', 'confidence', 'event_time'],
                  properties: {
                    source_id: { type: 'string' },
                    classification: { type: 'string', enum: CALENDAR_CLASSIFICATIONS },
                    should_notify: { type: 'boolean' },
                    confidence: { type: 'number', minimum: 0, maximum: 1 },
                    event_time: { anyOf: [{ type: 'string' }, { type: 'null' }] },
                  },
                },
              },
            },
          },
        },
      },
    },
  })

  for (const [keyIndex, apiKey] of apiKeys.entries()) {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`,
      { method: 'POST', headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey }, body: requestBody },
    )
    if (response.ok) {
      const data = await response.json() as GeminiResponse
      const parts = data.candidates?.[0]?.content?.parts ?? []
      if (parts.length === 0) throw new HttpError(502, 'Gemini boş bir cevap döndürdü.')
      return {
        value: parseGeminiJson(parts),
        inputTokens: data.usageMetadata?.promptTokenCount ?? 0,
        outputTokens: data.usageMetadata?.candidatesTokenCount ?? 0,
      }
    }
    if (keyIndex < apiKeys.length - 1 && [401, 403, 429, 500, 502, 503, 504].includes(response.status)) continue
    throw new HttpError(response.status === 429 ? 429 : 502, response.status === 429 ? 'Gemini ücretsiz kotası şu anda dolu.' : 'Gemini isteği başarısız oldu.')
  }
  throw new HttpError(503, 'Gemini API anahtarı yapılandırılmadı.')
}

function calendarReminderTimes(entry: CalendarEntryRecord, result: CalendarClassificationResult): string[] {
  if (!result.should_notify) return []
  const eventAt = result.event_time
    ? new Date(`${entry.start_date}T${result.event_time}:00+03:00`)
    : new Date(`${entry.start_date}T09:00:00+03:00`)
  const offsets = result.event_time && ['club_meeting', 'governance'].includes(result.classification)
    ? [24 * 60 * 60 * 1000, 60 * 60 * 1000]
    : result.classification === 'holiday'
      ? [0]
      : [15 * 60 * 60 * 1000]
  const now = Date.now()
  return offsets
    .map((offset) => new Date(eventAt.getTime() - offset).toISOString())
    .filter((scheduledAt) => Date.parse(scheduledAt) > now)
}

function calendarReminderBody(entry: CalendarEntryRecord, result: CalendarClassificationResult, scheduledAt: string): string {
  const eventAt = result.event_time
    ? new Date(`${entry.start_date}T${result.event_time}:00+03:00`).getTime()
    : new Date(`${entry.start_date}T09:00:00+03:00`).getTime()
  const hours = Math.round((eventAt - Date.parse(scheduledAt)) / 3_600_000)
  if (hours <= 1) return `“${entry.title}” bir saat içinde başlayacak.`
  if (result.classification === 'holiday') return `Bugün ${entry.title}. MUPSA olarak güzel bir gün dileriz.`
  return `“${entry.title}” yarın. Ayrıntılar için takvimi açabilirsiniz.`
}

async function storeCalendarClassification(
  adminClient: ReturnType<typeof createClient>,
  entry: CalendarEntryRecord,
  result: CalendarClassificationResult,
  model: string,
  sourceHash: string,
): Promise<number> {
  const scheduledTimes = calendarReminderTimes(entry, result)
  await adminClient
    .from('notifications')
    .delete()
    .eq('notification_type', 'calendar_entry_reminder')
    .eq('delivery_status', 'queued')
    .gt('scheduled_for', new Date().toISOString())
    .contains('metadata', { calendar_entry_id: entry.id })

  const { error: planError } = await adminClient.from('calendar_ai_notification_plans').upsert({
    calendar_entry_id: entry.id,
    period_id: entry.period_id,
    classification: result.classification,
    should_notify: result.should_notify,
    confidence: result.confidence,
    event_time: result.event_time,
    model_id: model,
    source_hash: sourceHash,
    scheduled_times: scheduledTimes,
    updated_at: new Date().toISOString(),
  })
  if (planError) throw new HttpError(500, 'Takvim bildirim planı saklanamadı.')
  if (scheduledTimes.length === 0) return 0

  const { data: memberships, error: membershipError } = await adminClient
    .from('period_memberships')
    .select('profile_id, profiles!inner(is_active)')
    .eq('period_id', entry.period_id)
    .eq('is_active', true)
    .eq('profiles.is_active', true)
  if (membershipError) throw new HttpError(500, 'Bildirim alıcıları hazırlanamadı.')

  const rows = scheduledTimes.flatMap((scheduledAt) => (memberships ?? []).map((membership) => ({
    recipient_id: membership.profile_id,
    notification_type: 'calendar_entry_reminder',
    channel: 'in_app',
    title: result.classification === 'holiday' ? entry.title : 'Takvim hatırlatması',
    body: calendarReminderBody(entry, result, scheduledAt),
    metadata: {
      calendar_entry_id: entry.id,
      calendar_date: entry.start_date,
      classification: result.classification,
      url: `/app/takvim?date=${encodeURIComponent(entry.start_date)}&entry=${encodeURIComponent(entry.id)}`,
    },
    dedupe_key: `calendar-reminder:${entry.id}:${sourceHash.slice(0, 12)}:${scheduledAt}:${membership.profile_id}:in_app`,
    scheduled_for: scheduledAt,
  })))
  if (rows.length > 0) {
    const { error } = await adminClient.from('notifications').insert(rows)
    if (error) throw new HttpError(500, 'Takvim bildirimleri planlanamadı.')
  }
  return rows.length
}

serve(async (request: Request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (request.method !== 'POST') return jsonResponse({ success: false, error: 'Yalnızca POST desteklenir.' }, 405)

  try {
    const authHeader = request.headers.get('Authorization')
    if (!authHeader) throw new HttpError(401, 'Yetkilendirme başlığı eksik.')

    const supabaseUrl = Deno.env.get('SUPABASE_URL')
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY')
    if (!supabaseUrl || !serviceRoleKey || !anonKey) throw new HttpError(500, 'Sunucu yapılandırması eksik.')

    const accessToken = authHeader.replace(/^Bearer\s+/i, '').trim()
    if (!accessToken) throw new HttpError(401, 'Oturum belirteci eksik.')

    const adminClient = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    })
    const { data: userData, error: userError } = await adminClient.auth.getUser(accessToken)
    if (userError || !userData.user) throw new HttpError(401, 'Geçersiz oturum.')

    const body = (await request.json()) as AiRequest
    if (body.operation !== 'status' && body.operation !== 'home_summary' && body.operation !== 'calendar_classification') {
      throw new HttpError(400, 'Desteklenmeyen AI işlemi.')
    }

    const { data: membershipData, error: membershipError } = await adminClient
      .from('period_memberships')
      .select('period_id, app_role, coordinator_role_id, periods!inner(is_active)')
      .eq('profile_id', userData.user.id)
      .eq('is_active', true)
      .eq('periods.is_active', true)
      .maybeSingle()
    if (membershipError || !membershipData) throw new HttpError(403, 'Aktif dönem üyeliği bulunamadı.')
    const membership = membershipData as unknown as MembershipRecord

    const { data: settingData, error: settingError } = await adminClient
      .from('ai_feature_settings')
      .select('is_enabled, free_tier_only, flash_model, flash_lite_model, embedding_model, policy_version')
      .eq('period_id', membership.period_id)
      .maybeSingle()
    if (settingError) throw new HttpError(500, 'AI ayarı okunamadı.')
    const setting = settingData as AiSettingRecord | null

    if (body.operation === 'status') {
      const configuredKeys = [
        Deno.env.get('GEMINI_API_KEY'),
        Deno.env.get('GEMINI_API_KEY_SECONDARY'),
      ].filter((key): key is string => Boolean(key))
      return jsonResponse({
        success: true,
        enabled: Boolean(setting?.is_enabled),
        freeTierOnly: setting?.free_tier_only ?? true,
        configured: configuredKeys.length > 0,
        policyVersion: setting?.policy_version ?? null,
        pilotScope: 'super_admin',
      })
    }

    if (membership.app_role !== 'super_admin') {
      throw new HttpError(403, 'AI ana sayfa pilotu yalnızca Süper Yöneticiye açıktır.')
    }
    if (!setting?.is_enabled || !setting.free_tier_only) {
      throw new HttpError(403, 'AI ana sayfa pilotu henüz etkin değil.')
    }
    const geminiApiKeys = [...new Set([
      Deno.env.get('GEMINI_API_KEY'),
      Deno.env.get('GEMINI_API_KEY_SECONDARY'),
    ].filter((key): key is string => Boolean(key)))]
    if (geminiApiKeys.length === 0) throw new HttpError(503, 'Gemini API anahtarı yapılandırılmadı.')

    if (body.operation === 'calendar_classification') {
      let entryQuery = adminClient
        .from('calendar_entries')
        .select('id, period_id, title, entry_type, start_date, end_date, note')
        .eq('period_id', membership.period_id)
        .is('deleted_at', null)
        .order('start_date', { ascending: true })
        .limit(body.calendar_entry_id ? 1 : 20)
      if (body.calendar_entry_id) entryQuery = entryQuery.eq('id', body.calendar_entry_id)
      const { data: entryData, error: entryError } = await entryQuery
      if (entryError) throw new HttpError(500, 'Takvim kayıtları sınıflandırma için okunamadı.')

      const today = new Date(Date.now() + 3 * 60 * 60 * 1000).toISOString().slice(0, 10)
      const futureEntries = ((entryData ?? []) as CalendarEntryRecord[]).filter((entry) => (entry.end_date ?? entry.start_date) >= today)
      if (futureEntries.length === 0) return jsonResponse({ success: true, classified: 0, scheduled: 0 })

      const sourceHashes = new Map<string, string>()
      for (const entry of futureEntries) {
        sourceHashes.set(entry.id, await sha256(JSON.stringify({
          title: entry.title,
          entry_type: entry.entry_type,
          start_date: entry.start_date,
          end_date: entry.end_date,
          note: entry.note,
        })))
      }
      const { data: existingPlans } = await adminClient
        .from('calendar_ai_notification_plans')
        .select('calendar_entry_id, source_hash')
        .in('calendar_entry_id', futureEntries.map((entry) => entry.id))
      const existingHashes = new Map((existingPlans ?? []).map((plan) => [plan.calendar_entry_id as string, plan.source_hash as string]))
      const candidates = futureEntries.filter((entry) => existingHashes.get(entry.id) !== sourceHashes.get(entry.id))
      if (candidates.length === 0) return jsonResponse({ success: true, classified: 0, scheduled: 0, cached: true })

      const model = modelForOperation({
        flashModel: setting.flash_model,
        flashLiteModel: setting.flash_lite_model,
        embeddingModel: setting.embedding_model,
      }, 'calendar_classification')
      const { data: reservation, error: reservationError } = await adminClient.rpc('reserve_ai_quota', {
        target_period_id: membership.period_id,
        target_requester_id: userData.user.id,
        target_operation_type: 'calendar_classification',
        target_model_id: model,
      })

      let results = candidates.map(deterministicCalendarClassification)
      let resultModel = 'rule-based-fallback'
      let inputTokens = 0
      let outputTokens = 0
      const usageId = !reservationError && isRecord(reservation) && reservation.allowed === true && typeof reservation.usage_id === 'string'
        ? reservation.usage_id
        : null
      if (usageId) {
        try {
          const gemini = await callGeminiCalendarClassifier(geminiApiKeys, model, candidates)
          inputTokens = gemini.inputTokens
          outputTokens = gemini.outputTokens
          results = validateCalendarClassifications(gemini.value, candidates)
          resultModel = model
          await adminClient.rpc('record_ai_usage_result', {
            target_usage_id: usageId,
            target_input_token_count: inputTokens,
            target_output_token_count: outputTokens,
            target_succeeded: true,
          })
        } catch (error) {
          console.error('Calendar classification fell back to verified rules', error)
          await adminClient.rpc('record_ai_usage_result', {
            target_usage_id: usageId,
            target_input_token_count: inputTokens,
            target_output_token_count: outputTokens,
            target_succeeded: false,
          })
        }
      }

      let scheduled = 0
      for (const result of results) {
        const entry = candidates.find((candidate) => candidate.id === result.source_id)
        if (!entry) continue
        scheduled += await storeCalendarClassification(adminClient, entry, result, resultModel, sourceHashes.get(entry.id)!)
      }
      return jsonResponse({ success: true, classified: results.length, scheduled, model: resultModel })
    }

    if (body.force) {
      const { error: forceRefreshError } = await adminClient
        .from('ai_outputs')
        .update({ is_current: false })
        .eq('period_id', membership.period_id)
        .eq('output_type', 'home_summary')
        .eq('is_current', true)
      if (forceRefreshError) console.error('AI home summary force refresh failed', forceRefreshError)
    } else {
      const { error: dueRefreshError } = await adminClient.rpc('apply_due_ai_home_summary_refresh', {
        target_period_id: membership.period_id,
      })
      if (dueRefreshError) console.error('Due AI home summary refresh could not be applied', dueRefreshError)
    }

    const { data: userLatestOutput } = await adminClient
      .from('ai_outputs')
      .select('payload, model_id, created_at, expires_at')
      .eq('period_id', membership.period_id)
      .eq('recipient_id', userData.user.id)
      .eq('output_type', 'home_summary')
      .eq('is_current', true)
      .eq('validation_status', 'valid')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()
    const { data: periodLatestOutput } = userLatestOutput
      ? { data: null }
      : await adminClient
        .from('ai_outputs')
        .select('payload, model_id, created_at, expires_at')
        .eq('period_id', membership.period_id)
        .eq('output_type', 'home_summary')
        .eq('is_current', true)
        .eq('validation_status', 'valid')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle()
    const latestOutput = userLatestOutput ?? periodLatestOutput
    const cacheIsFresh = latestOutput?.expires_at
      && Date.parse(latestOutput.expires_at) > Date.now()
    if (latestOutput && cacheIsFresh) {
      return jsonResponse({
        success: true,
        output: latestOutput.payload,
        generatedAt: latestOutput.created_at,
        model: latestOutput.model_id,
        cached: true,
      })
    }

    const userClient = createClient(supabaseUrl, anonKey, {
      auth: { autoRefreshToken: false, persistSession: false },
      global: { headers: { Authorization: authHeader } },
    })
    const { data: contextData, error: contextError } = await userClient.rpc('get_my_ai_home_context', {
      target_period_id: membership.period_id,
    })
    if (contextError) throw new HttpError(500, 'AI ana sayfa bağlamı hazırlanamadı.')
    const context = normalizeHomeContext(contextData)
    const historyOutput = latestOutput ?? (await adminClient
      .from('ai_outputs')
      .select('payload, model_id, created_at, expires_at')
      .eq('period_id', membership.period_id)
      .eq('recipient_id', userData.user.id)
      .eq('output_type', 'home_summary')
      .eq('validation_status', 'valid')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()).data
    const startOfToday = new Date()
    startOfToday.setHours(0, 0, 0, 0)
    const { data: activityData, error: activityError } = await userClient.rpc('get_my_ai_home_activity', {
      target_period_id: membership.period_id,
      target_changed_since: historyOutput?.created_at ?? startOfToday.toISOString(),
    })
    if (activityError) console.error('AI home activity delta could not be loaded', activityError)
    context.activity = isRecord(activityData) ? asItems(activityData.items) : []
    const sources = prepareHomeSources(context, historyOutput?.payload)
    if (sources.length === 0) {
      const emptyPayload = { intro: 'Bugün için yeni bir ekip hareketi veya kritik durum bulunmuyor.', items: [] }
      const emptyContextHash = await sha256(JSON.stringify({ context, mode: 'verified_empty_delta' }))
      await adminClient
        .from('ai_outputs')
        .update({ is_current: false })
        .eq('period_id', membership.period_id)
        .eq('recipient_id', userData.user.id)
        .eq('output_type', 'home_summary')
        .eq('is_current', true)
      const { error: emptyOutputError } = await adminClient.from('ai_outputs').insert({
        period_id: membership.period_id,
        recipient_id: userData.user.id,
        output_type: 'home_summary',
        payload: emptyPayload,
        source_manifest: [],
        context_hash: emptyContextHash,
        model_id: 'verified-delta',
        validation_status: 'valid',
        validation_errors: [],
        is_current: true,
        expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
      })
      if (emptyOutputError) console.error('Verified empty AI delta could not be stored', emptyOutputError)
      return jsonResponse({
        success: true,
        output: emptyPayload,
        generatedAt: new Date().toISOString(),
        model: 'verified-delta',
      })
    }

    const model = modelForOperation({
      flashModel: setting.flash_model,
      flashLiteModel: setting.flash_lite_model,
      embeddingModel: setting.embedding_model,
    }, 'home_summary')
    const { data: reservation, error: reservationError } = await adminClient.rpc('reserve_ai_quota', {
      target_period_id: membership.period_id,
      target_requester_id: userData.user.id,
      target_operation_type: 'home_summary',
      target_model_id: model,
    })
    if (reservationError || !isRecord(reservation) || reservation.allowed !== true || typeof reservation.usage_id !== 'string') {
      if (historyOutput) {
        return jsonResponse({
          success: true,
          output: historyOutput.payload,
          generatedAt: historyOutput.created_at,
          model: historyOutput.model_id,
          cached: true,
          stale: true,
          warning: 'Yeni özet üretilemedi; son doğrulanmış özet gösteriliyor.',
        })
      }
      const payload = buildRuleBasedPayload(sources)
      const contextHash = await sha256(JSON.stringify({ context, sources, mode: 'rule_based_fallback' }))
      const generatedAt = new Date().toISOString()
      const { error: fallbackOutputError } = await adminClient.from('ai_outputs').insert({
        period_id: membership.period_id,
        recipient_id: userData.user.id,
        output_type: 'home_summary',
        payload,
        source_manifest: sources.slice(0, 3).map((source) => ({
          alias: source.alias,
          entity_type: source.entityType,
          entity_id: source.entityId,
        })),
        context_hash: contextHash,
        model_id: 'rule-based-fallback',
        validation_status: 'valid',
        validation_errors: [],
        is_current: true,
        expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
      })
      if (fallbackOutputError) console.error('Rule-based fallback could not be stored', fallbackOutputError)
      return jsonResponse({
        success: true,
        output: payload,
        generatedAt,
        model: 'rule-based-fallback',
        cached: false,
        warning: 'Google günlük kotası dolduğu için özet, doğrulanmış uygulama kayıtlarından hazırlandı.',
      })
    }

    const usageId = reservation.usage_id
    let inputTokens = 0
    let outputTokens = 0
    try {
      const gemini = await callGemini(geminiApiKeys, model, context, sources)
      inputTokens = gemini.inputTokens
      outputTokens = gemini.outputTokens
      const validation = validateHomeSummaryPlan(gemini.value, sources)
      if (!validation.plan || validation.errors.length > 0) {
        console.error('Home summary validation failed', validation.errors)
        throw new HttpError(502, 'AI özeti güvenlik doğrulamasından geçemedi.')
      }

      const sourceByAlias = new Map(sources.map((source) => [source.alias, source]))
      const resolvedItems = validation.plan.items.map((item) => {
        const source = sourceByAlias.get(item.sourceRef)
        if (!source) throw new HttpError(502, 'AI özeti geçersiz kaynak içeriyor.')
        return {
          source_ref: item.sourceRef,
          source_type: source.entityType,
          source_id: source.entityId,
          title: source.title,
          reason_code: item.reasonCode,
          recommendation: item.recommendation,
          action: item.action,
          route: source.route,
        }
      })
      const payload = { intro: buildDailyIntro(resolvedItems), items: resolvedItems }
      const contextHash = await sha256(JSON.stringify({ context, sources }))

      await adminClient
        .from('ai_outputs')
        .update({ is_current: false })
        .eq('period_id', membership.period_id)
        .eq('recipient_id', userData.user.id)
        .eq('output_type', 'home_summary')
        .eq('is_current', true)

      const { error: outputError } = await adminClient.from('ai_outputs').insert({
        period_id: membership.period_id,
        recipient_id: userData.user.id,
        output_type: 'home_summary',
        payload,
        source_manifest: sources.map((source) => ({
          alias: source.alias,
          entity_type: source.entityType,
          entity_id: source.entityId,
        })),
        context_hash: contextHash,
        model_id: model,
        validation_status: 'valid',
        validation_errors: [],
        is_current: true,
        expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
      })
      if (outputError) throw new HttpError(500, 'Doğrulanmış AI özeti saklanamadı.')

      await adminClient.rpc('record_ai_usage_result', {
        target_usage_id: usageId,
        target_input_token_count: inputTokens,
        target_output_token_count: outputTokens,
        target_succeeded: true,
      })
      return jsonResponse({ success: true, output: payload, generatedAt: new Date().toISOString(), model })
    } catch (error) {
      await adminClient.rpc('record_ai_usage_result', {
        target_usage_id: usageId,
        target_input_token_count: inputTokens,
        target_output_token_count: outputTokens,
        target_succeeded: false,
      })
      if (historyOutput) {
        return jsonResponse({
          success: true,
          output: historyOutput.payload,
          generatedAt: historyOutput.created_at,
          model: historyOutput.model_id,
          cached: true,
          stale: true,
          warning: 'Yeni özet üretilemedi; son doğrulanmış özet gösteriliyor.',
        })
      }
      const payload = buildRuleBasedPayload(sources)
      return jsonResponse({
        success: true,
        output: payload,
        generatedAt: new Date().toISOString(),
        model: 'rule-based-fallback',
        cached: false,
        warning: error instanceof HttpError && error.status === 429
          ? 'Google günlük kotası dolduğu için özet, doğrulanmış uygulama kayıtlarından hazırlandı.'
          : 'AI servisine ulaşılamadığı için özet, doğrulanmış uygulama kayıtlarından hazırlandı.',
      })
    }
  } catch (error) {
    const status = error instanceof HttpError ? error.status : 500
    const message = error instanceof Error ? error.message : 'AI işlemi başarısız oldu.'
    return jsonResponse({ success: false, error: message }, status)
  }
})
