import { serve } from 'https://deno.land/std@0.192.0/http/server.ts'
import { createClient, type SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0'
import { buildDeterministicHomeSummary, fallbackCopy } from '../_shared/mupiPriority.ts'
import { sanitizeMupiFacts, sanitizeMupiText } from '../_shared/mupiSanitize.ts'
import { modelForOperation, type DeterministicHomeSummaryDecision, type DeterministicHomeSummaryItem } from '../_shared/aiCore.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-push-dispatch-secret',
}

interface RequestBody {
  force?: boolean
  target_profile_id?: string
}

interface MembershipRecord {
  period_id: string
  profile_id: string
  app_role: 'super_admin' | 'coordinator'
}

interface AiSettingRecord {
  is_enabled: boolean
  free_tier_only: boolean
  flash_model: string
  flash_lite_model: string
  embedding_model: string
}

interface GeminiResponse {
  candidates?: Array<{ content?: { parts?: Array<{ text?: string; thought?: boolean }> } }>
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

function istanbulDate(): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Istanbul', year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(new Date())
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]))
  return `${values.year}-${values.month}-${values.day}`
}

async function sha256(value: string): Promise<string> {
  const bytes = new TextEncoder().encode(value)
  const digest = await crypto.subtle.digest('SHA-256', bytes)
  return Array.from(new Uint8Array(digest)).map((byte) => byte.toString(16).padStart(2, '0')).join('')
}

function sanitizeDecision(decision: DeterministicHomeSummaryDecision): DeterministicHomeSummaryDecision {
  const clean = (item: DeterministicHomeSummaryItem): DeterministicHomeSummaryItem => ({
    ...item,
    title: sanitizeMupiText(item.title, 160),
    fallbackDetail: sanitizeMupiText(item.fallbackDetail, 220),
    facts: sanitizeMupiFacts(item.facts),
  })
  return { summaryDate: decision.summaryDate, today: decision.today.map(clean), upcoming: decision.upcoming.map(clean) }
}

function parseGeminiJson(parts: Array<{ text?: string; thought?: boolean }>): unknown {
  const texts = parts
    .filter((part) => part.thought !== true && typeof part.text === 'string' && part.text.trim())
    .map((part) => part.text!.trim())
  for (const text of [...texts].reverse()) {
    try {
      return JSON.parse(text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim())
    } catch {
      // Siradaki nihai metni dene.
    }
  }
  throw new HttpError(502, 'Gemini cevabı JSON olarak ayrıştırılamadı.')
}

function validateWording(value: unknown, selected: DeterministicHomeSummaryItem[]): Map<string, string> {
  if (!isRecord(value) || !Array.isArray(value.items)) throw new HttpError(502, 'Gemini metin cevabı geçersiz.')
  const allowed = new Set(selected.map((item) => item.alias))
  const result = new Map<string, string>()
  for (const raw of value.items) {
    if (!isRecord(raw) || typeof raw.source_ref !== 'string' || !allowed.has(raw.source_ref)) continue
    if (typeof raw.recommendation !== 'string') continue
    const text = sanitizeMupiText(raw.recommendation, 220)
    if (!text || result.has(raw.source_ref)) continue
    result.set(raw.source_ref, text)
  }
  if (result.size !== selected.length) throw new HttpError(502, 'Gemini seçili maddelerin tamamı için güvenli metin üretmedi.')
  return result
}

async function orderedGeminiKeys(keys: string[], seed: string): Promise<string[]> {
  if (keys.length <= 1) return keys
  const hash = await sha256(seed)
  const start = parseInt(hash.slice(0, 2), 16) % keys.length
  return [...keys.slice(start), ...keys.slice(0, start)]
}

async function callGeminiForWording(
  apiKeys: string[],
  model: string,
  decision: DeterministicHomeSummaryDecision,
  recipientId: string,
): Promise<{ wording: Map<string, string>; inputTokens: number; outputTokens: number }> {
  const selected = [...decision.today, ...decision.upcoming]
  if (selected.length === 0) return { wording: new Map(), inputTokens: 0, outputTokens: 0 }
  const keys = await orderedGeminiKeys(apiKeys, `${recipientId}:${decision.summaryDate}`)
  const body = JSON.stringify({
    systemInstruction: {
      parts: [{ text: [
        'Sen MUPİ günlük özetinin yalnızca Türkçe ifade katmanısın.',
        'Hangi maddenin Bugün veya Yakında olduğu, sırası, reason_code ve action sistem tarafından kesin olarak seçildi; bunları değiştirme.',
        'Yeni gerçek, tarih, kişi, sayı, neden-sonuç, kurum kuralı veya görev üretme.',
        'Her source_ref için tek kısa, doğal ve eyleme dönük cümle yaz. Kaynak ekleme veya çıkarma.',
        'Kayıt oluşturma, silme, atama, bildirim gönderme veya otomatik durum değiştirme talimatı verme.',
      ].join('\n') }],
    },
    contents: [{ role: 'user', parts: [{ text: JSON.stringify({
      summary_date: decision.summaryDate,
      items: selected.map((item) => ({
        source_ref: item.alias,
        bucket: item.bucket,
        reason_code: item.reasonCode,
        title: item.title,
        fallback_detail: item.fallbackDetail,
        facts: item.facts,
      })),
    }) }] }],
    generationConfig: {
      maxOutputTokens: 700,
      thinkingConfig: { thinkingLevel: 'LOW' },
      responseFormat: {
        text: {
          mimeType: 'APPLICATION_JSON',
          schema: {
            type: 'object', required: ['items'], properties: {
              items: { type: 'array', items: { type: 'object', required: ['source_ref', 'recommendation'], properties: {
                source_ref: { type: 'string' }, recommendation: { type: 'string', maxLength: 220 },
              } } },
            },
          },
        },
      },
    },
  })

  for (const [index, apiKey] of keys.entries()) {
    let response: Response
    try {
      response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
          body,
          signal: AbortSignal.timeout(8_000),
        },
      )
    } catch (error) {
      if (index < keys.length - 1) continue
      throw error
    }
    if (response.ok) {
      const data = await response.json() as GeminiResponse
      const parts = data.candidates?.[0]?.content?.parts ?? []
      const wording = validateWording(parseGeminiJson(parts), selected)
      return {
        wording,
        inputTokens: data.usageMetadata?.promptTokenCount ?? 0,
        outputTokens: data.usageMetadata?.candidatesTokenCount ?? 0,
      }
    }
    if (index < keys.length - 1 && [401, 403, 429, 500, 502, 503, 504].includes(response.status)) continue
    throw new HttpError(response.status === 429 ? 429 : 502, response.status === 429 ? 'Gemini ücretsiz kotası dolu.' : 'Gemini isteği başarısız oldu.')
  }
  throw new HttpError(503, 'Gemini API anahtarı yapılandırılmadı.')
}

function buildPayload(
  decision: DeterministicHomeSummaryDecision,
  wording: Map<string, string> | null,
  generatedBy: string,
) {
  const resolve = (item: DeterministicHomeSummaryItem) => ({
    source_ref: item.alias,
    source_type: item.entityType,
    source_id: item.entityId,
    title: item.title,
    reason_code: item.reasonCode,
    recommendation: wording?.get(item.alias) ?? fallbackCopy(item),
    action: item.action,
    route: item.route,
    urgency: item.urgency,
    score: item.score,
  })
  const today = decision.today.map(resolve)
  const upcoming = decision.upcoming.map(resolve)
  return {
    schema_version: 'mupi-daily-summary-v2',
    summary_date: decision.summaryDate,
    intro: today.length > 0
      ? `Bugün öncelik vermen gereken ${today.length} konu var.`
      : 'Bugün için acil bir aksiyon görünmüyor.',
    today,
    upcoming,
    // Gecis doneminde eski frontend ve eski orchestrator cache kontrolu icin tutulur.
    items: [...today, ...upcoming],
    generated_by: generatedBy,
  }
}

serve(async (request: Request) => {
  let guardJobId: string | null = null
  let guardClient: SupabaseClient | null = null

  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (request.method !== 'POST') return jsonResponse({ success: false, error: 'Yalnızca POST desteklenir.' }, 405)

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY')
    if (!supabaseUrl || !serviceRoleKey || !anonKey) throw new HttpError(500, 'Sunucu yapılandırması eksik.')

    const adminClient = createClient(supabaseUrl, serviceRoleKey, { auth: { autoRefreshToken: false, persistSession: false } })
    guardClient = adminClient
    const body = await request.json() as RequestBody
    const dispatchSecret = Deno.env.get('PUSH_DISPATCH_SECRET')
    const scheduled = Boolean(dispatchSecret && request.headers.get('x-push-dispatch-secret') === dispatchSecret && body.target_profile_id)
    const authHeader = request.headers.get('Authorization')

    let requesterId = ''
    if (scheduled) {
      requesterId = body.target_profile_id!
    } else {
      if (!authHeader) throw new HttpError(401, 'Yetkilendirme başlığı eksik.')
      const token = authHeader.replace(/^Bearer\s+/i, '').trim()
      const { data, error } = await adminClient.auth.getUser(token)
      if (error || !data.user) throw new HttpError(401, 'Geçersiz oturum.')
      requesterId = data.user.id
    }

    const { data: membershipData, error: membershipError } = await adminClient
      .from('period_memberships')
      .select('period_id, profile_id, app_role, periods!inner(is_active), profiles!inner(is_active)')
      .eq('profile_id', requesterId)
      .eq('is_active', true)
      .eq('periods.is_active', true)
      .eq('profiles.is_active', true)
      .limit(1)
      .maybeSingle()
    if (membershipError || !membershipData) throw new HttpError(403, 'Aktif dönem üyeliği bulunamadı.')
    const membership = membershipData as unknown as MembershipRecord

    if (body.force && !scheduled && membership.app_role !== 'super_admin') {
      throw new HttpError(403, 'Zorunlu MUPİ yenilemesini yalnızca Süper Yönetici başlatabilir.')
    }

    const { data: settingData, error: settingError } = await adminClient
      .from('ai_feature_settings')
      .select('is_enabled, free_tier_only, flash_model, flash_lite_model, embedding_model')
      .eq('period_id', membership.period_id)
      .maybeSingle()
    if (settingError) throw new HttpError(500, 'MUPİ ayarı okunamadı.')
    const setting = settingData as AiSettingRecord | null
    if (!setting?.is_enabled || !setting.free_tier_only) throw new HttpError(403, 'MUPİ özellikleri etkin değil.')

    const summaryDate = istanbulDate()
    const readExisting = async () => adminClient
      .from('ai_outputs')
      .select('payload, model_id, created_at, context_hash')
      .eq('period_id', membership.period_id)
      .eq('recipient_id', requesterId)
      .eq('output_type', 'home_summary')
      .eq('summary_date', summaryDate)
      .eq('validation_status', 'valid')
      .limit(1)
      .maybeSingle()

    const { data: existing } = await readExisting()
    if (existing && !body.force) {
      return jsonResponse({ success: true, output: existing.payload, generatedAt: existing.created_at, model: existing.model_id, cached: true })
    }

    const { data: guardData, error: guardError } = await adminClient.rpc('reserve_mupi_daily_generation', {
      target_period_id: membership.period_id,
      target_recipient_id: requesterId,
      target_summary_date: summaryDate,
      target_force: body.force === true,
    })
    if (guardError || !isRecord(guardData)) throw new HttpError(500, 'MUPİ üretim kilidi alınamadı.')
    if (guardData.allowed !== true) {
      const { data: racedOutput } = await readExisting()
      if (racedOutput) {
        return jsonResponse({ success: true, output: racedOutput.payload, generatedAt: racedOutput.created_at, model: racedOutput.model_id, cached: true })
      }
      return jsonResponse({
        success: true,
        pending: true,
        warning: 'Bu kullanıcının bugünkü MUPİ özeti başka bir işlem tarafından hazırlanıyor.',
      }, 202)
    }
    guardJobId = typeof guardData.job_id === 'string' ? guardData.job_id : null

    const userClient = scheduled ? null : createClient(supabaseUrl, anonKey, {
      auth: { autoRefreshToken: false, persistSession: false },
      global: { headers: { Authorization: authHeader! } },
    })
    const { data: contextData, error: contextError } = scheduled
      ? await adminClient.rpc('get_ai_home_context_for_member', { target_period_id: membership.period_id, target_profile_id: requesterId })
      : await userClient!.rpc('get_my_mupi_daily_context', { target_period_id: membership.period_id })
    if (contextError || !isRecord(contextData)) throw new HttpError(500, 'MUPİ günlük bağlamı hazırlanamadı.')

    // Manuel takvim uygulamada tum aktif uyelerin ortak gorunumundedir. Context RPC
    // zaten RLS/yetki kurallarini uyguladigi icin koordinatorde takvimi ayrica silmeyiz.
    const decision = sanitizeDecision(buildDeterministicHomeSummary({ context: contextData, summaryDate }))
    const inputFingerprint = await sha256(JSON.stringify(decision))

    let payload = buildPayload(decision, null, 'deterministic-v2')
    let resultModel = 'deterministic-v2'
    let warning: string | undefined
    const selected = [...decision.today, ...decision.upcoming]

    if (selected.length > 0) {
      const apiKeys = [...new Set([
        Deno.env.get('GEMINI_API_KEY'), Deno.env.get('GEMINI_API_KEY_SECONDARY'),
      ].filter((key): key is string => Boolean(key)))]
      const model = modelForOperation({
        flashModel: setting.flash_model,
        flashLiteModel: setting.flash_lite_model,
        embeddingModel: setting.embedding_model,
      }, 'home_summary')
      const { data: reservation, error: reservationError } = await adminClient.rpc('reserve_ai_quota', {
        target_period_id: membership.period_id,
        target_requester_id: requesterId,
        target_operation_type: 'home_summary',
        target_model_id: model,
      })
      const usageId = !reservationError && isRecord(reservation) && reservation.allowed === true && typeof reservation.usage_id === 'string'
        ? reservation.usage_id
        : null

      if (usageId && apiKeys.length > 0) {
        let inputTokens = 0
        let outputTokens = 0
        try {
          const result = await callGeminiForWording(apiKeys, model, decision, requesterId)
          inputTokens = result.inputTokens
          outputTokens = result.outputTokens
          payload = buildPayload(decision, result.wording, model)
          resultModel = model
          await adminClient.rpc('record_ai_usage_result', {
            target_usage_id: usageId,
            target_input_token_count: inputTokens,
            target_output_token_count: outputTokens,
            target_succeeded: true,
          })
        } catch (error) {
          console.error('MUPI wording fallback', error)
          await adminClient.rpc('record_ai_usage_result', {
            target_usage_id: usageId,
            target_input_token_count: inputTokens,
            target_output_token_count: outputTokens,
            target_succeeded: false,
          })
          warning = 'MUPİ anlatım servisine ulaşılamadı; özet doğrulanmış uygulama kurallarıyla hazırlandı.'
        }
      } else {
        warning = 'AI kotası kullanılamadığı için özet doğrulanmış uygulama kurallarıyla hazırlandı.'
      }
    }

    const manifest = selected.map((item) => ({ alias: item.alias, entity_type: item.entityType, entity_id: item.entityId, reason_code: item.reasonCode, bucket: item.bucket }))
    const { data: outputId, error: outputError } = await adminClient.rpc('replace_mupi_daily_output', {
      target_period_id: membership.period_id,
      target_recipient_id: requesterId,
      target_summary_date: summaryDate,
      target_payload: payload,
      target_source_manifest: manifest,
      target_context_hash: inputFingerprint,
      target_model_id: resultModel,
      target_expires_at: new Date(Date.now() + 26 * 60 * 60 * 1000).toISOString(),
    })
    if (outputError || typeof outputId !== 'string') throw new HttpError(500, 'MUPİ günlük özeti saklanamadı.')

    if (guardJobId) {
      await adminClient.rpc('complete_mupi_daily_generation', {
        target_job_id: guardJobId,
        target_succeeded: true,
        target_error_code: null,
      })
      guardJobId = null
    }

    return jsonResponse({ success: true, output: payload, generatedAt: new Date().toISOString(), model: resultModel, cached: false, ...(warning ? { warning } : {}) })
  } catch (error) {
    if (guardJobId && guardClient) {
      try {
        await guardClient.rpc('complete_mupi_daily_generation', {
          target_job_id: guardJobId,
          target_succeeded: false,
          target_error_code: error instanceof Error ? error.name : 'mupi_generation_failed',
        })
      } catch (guardCompletionError) {
        console.error('MUPI generation guard could not be marked failed', guardCompletionError)
      }
    }
    const status = error instanceof HttpError ? error.status : 500
    const message = error instanceof Error ? error.message : 'MUPİ günlük özeti hazırlanamadı.'
    return jsonResponse({ success: false, error: message }, status)
  }
})
