import { serve } from 'https://deno.land/std@0.192.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0'
import {
  modelForOperation,
  validateHomeSummaryPlan,
  type HomeSummaryReasonCode,
  type HomeSummarySource,
  type HomeSummarySourceType,
} from '../_shared/aiCore.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface AiRequest {
  operation?: 'status' | 'home_summary'
  force?: boolean
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
  }
}

function numberValue(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null
}

function allowedReasons(item: HomeContextItem): HomeSummaryReasonCode[] {
  const reasons: HomeSummaryReasonCode[] = []
  if (item.source_type === 'task') {
    if (item.is_overdue === true) reasons.push('overdue_task')
    const deadline = typeof item.deadline_at === 'string' ? Date.parse(item.deadline_at) : Number.NaN
    if (!item.is_overdue && Number.isFinite(deadline) && deadline <= Date.now() + 3 * 86_400_000) {
      reasons.push('due_soon_task')
    }
    if (item.priority === 'high' || item.priority === 'urgent') reasons.push('high_priority_task')
    if (item.assignment_type === 'primary' || item.assignment_type === 'supporting') {
      reasons.push('assigned_open_task')
    }
    reasons.push('open_task')
  }
  if (item.source_type === 'event') {
    if (Array.isArray(item.missing_fields) && item.missing_fields.length > 0) reasons.push('missing_event_field')
    if (item.lifecycle_phase === 'preparation') reasons.push('event_preparation_active')
    if (item.lifecycle_phase === 'final_days') reasons.push('event_final_days')
    if (item.lifecycle_phase === 'event_day') reasons.push('event_day')
    if (item.lifecycle_phase === 'report_due') reasons.push('event_report_due')
  }
  if (item.source_type === 'awareness') {
    if (Array.isArray(item.missing_fields) && item.missing_fields.length > 0) reasons.push('missing_awareness_field')
    const daysUntilShare = numberValue(item.days_until_share)
    if (daysUntilShare !== null && daysUntilShare >= 0 && daysUntilShare <= 7) {
      reasons.push('awareness_share_due_soon')
    } else if (item.preparation_start_date && daysUntilShare !== null && daysUntilShare > 7) {
      reasons.push('awareness_preparation_active')
    }
  }
  if (item.source_type === 'calendar_entry') {
    const daysUntil = numberValue(item.days_until)
    if (daysUntil !== null && daysUntil >= 0 && daysUntil <= 14) reasons.push('upcoming_calendar_entry')
  }
  return [...new Set(reasons)]
}

function prepareHomeSources(context: HomeContext): PreparedHomeSource[] {
  const candidates = [
    ...context.tasks.slice(0, 12),
    ...context.events.slice(0, 8),
    ...context.awareness.slice(0, 8),
    ...context.calendar.slice(0, 8),
  ]
  return candidates
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
    .map((source, index) => ({ ...source, alias: `S${index + 1}` }))
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
  apiKey: string,
  model: string,
  context: HomeContext,
  sources: PreparedHomeSource[],
): Promise<{ value: unknown; inputTokens: number; outputTokens: number }> {
  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
      body: JSON.stringify({
        systemInstruction: {
          parts: [{
            text: [
              'Sen MUPSA ekip koordinasyon uygulamasının salt-okunur çalışma danışmanısın.',
              'Yalnızca verilen kaynakları seç. Yeni gerçek, sayı, neden-sonuç veya kurum kuralı üretme.',
              'Her maddede tam bir source_ref, o kaynak için allowed_reason_codes içinden bir reason_code ve kaynak türüne uygun action kullan.',
              'Recommendation yalnızca kısa bir öneridir; kayıt oluşturma, silme, atama, bildirim gönderme veya durum değiştirme talimatı verme.',
              'Etkinlik raporunu yalnızca event_report_due nedeni sunulmuşsa öner.',
              'Intro genel ve kısa olsun; doğrulanmamış sayı veya iddia içermesin.',
              'En yararlı en fazla 6 maddeyi seç.',
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
          maxOutputTokens: 900,
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
                    maxItems: 6,
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
      }),
    },
  )

  if (!response.ok) {
    const errorBody = await response.text()
    const errorMessage = response.status === 429
      ? 'Gemini ücretsiz kotası şu anda dolu.'
      : 'Gemini isteği başarısız oldu.'
    console.error('Gemini request failed', response.status, errorBody.slice(0, 300))
    throw new HttpError(response.status === 429 ? 429 : 502, errorMessage)
  }

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
    if (body.operation !== 'status' && body.operation !== 'home_summary') {
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
      return jsonResponse({
        success: true,
        enabled: Boolean(setting?.is_enabled),
        freeTierOnly: setting?.free_tier_only ?? true,
        configured: Boolean(Deno.env.get('GEMINI_API_KEY')),
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
    const geminiApiKey = Deno.env.get('GEMINI_API_KEY')
    if (!geminiApiKey) throw new HttpError(503, 'Gemini API anahtarı yapılandırılmadı.')

    const { data: latestOutput } = await adminClient
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
    const cacheIsFresh = latestOutput?.expires_at
      && Date.parse(latestOutput.expires_at) > Date.now()
    const forceRefreshIsTooSoon = body.force === true
      && latestOutput?.created_at
      && Date.parse(latestOutput.created_at) > Date.now() - 15 * 60 * 1000
    if (latestOutput && cacheIsFresh && (body.force !== true || forceRefreshIsTooSoon)) {
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
    const sources = prepareHomeSources(context)
    if (sources.length === 0) {
      return jsonResponse({
        success: true,
        output: { intro: 'Bugün için öncelikli bir AI önerisi bulunmuyor.', items: [] },
        generatedAt: new Date().toISOString(),
        model: null,
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
      if (latestOutput) {
        return jsonResponse({
          success: true,
          output: latestOutput.payload,
          generatedAt: latestOutput.created_at,
          model: latestOutput.model_id,
          cached: true,
          stale: true,
          warning: 'Yeni özet üretilemedi; son doğrulanmış özet gösteriliyor.',
        })
      }
      throw new HttpError(429, 'AI günlük kullanım sınırı dolu; son geçerli özet kullanılmalı.')
    }

    const usageId = reservation.usage_id
    let inputTokens = 0
    let outputTokens = 0
    try {
      const gemini = await callGemini(geminiApiKey, model, context, sources)
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
      const payload = { intro: validation.plan.intro, items: resolvedItems }
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
      if (latestOutput) {
        return jsonResponse({
          success: true,
          output: latestOutput.payload,
          generatedAt: latestOutput.created_at,
          model: latestOutput.model_id,
          cached: true,
          stale: true,
          warning: 'Yeni özet üretilemedi; son doğrulanmış özet gösteriliyor.',
        })
      }
      throw error
    }
  } catch (error) {
    const status = error instanceof HttpError ? error.status : 500
    const message = error instanceof Error ? error.message : 'AI işlemi başarısız oldu.'
    return jsonResponse({ success: false, error: message }, status)
  }
})
