import { serve } from 'https://deno.land/std@0.192.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface AiStatusRequest {
  operation: 'status'
}

function jsonResponse(body: Record<string, unknown>, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

serve(async (request: Request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (request.method !== 'POST') return jsonResponse({ success: false, error: 'Yalnızca POST desteklenir.' }, 405)

  try {
    const authHeader = request.headers.get('Authorization')
    if (!authHeader) throw new Error('Yetkilendirme başlığı eksik.')

    const supabaseUrl = Deno.env.get('SUPABASE_URL')
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
    if (!supabaseUrl || !serviceRoleKey) throw new Error('Sunucu yapılandırması eksik.')

    const accessToken = authHeader.replace(/^Bearer\s+/i, '').trim()
    if (!accessToken) throw new Error('Oturum belirteci eksik.')

    const adminClient = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    })
    const { data: userData, error: userError } = await adminClient.auth.getUser(accessToken)
    if (userError || !userData.user) throw new Error('Geçersiz oturum.')

    const body = (await request.json()) as Partial<AiStatusRequest>
    if (body.operation !== 'status') {
      return jsonResponse({
        success: false,
        error: 'AI üretim işlemleri henüz etkinleştirilmedi.',
      }, 501)
    }

    const { data: membership, error: membershipError } = await adminClient
      .from('period_memberships')
      .select('period_id, app_role, coordinator_role_id, periods!inner(is_active)')
      .eq('profile_id', userData.user.id)
      .eq('is_active', true)
      .eq('periods.is_active', true)
      .maybeSingle()
    if (membershipError || !membership) throw new Error('Aktif dönem üyeliği bulunamadı.')

    const { data: setting, error: settingError } = await adminClient
      .from('ai_feature_settings')
      .select('is_enabled, free_tier_only, policy_version')
      .eq('period_id', membership.period_id)
      .maybeSingle()
    if (settingError) throw new Error('AI ayarı okunamadı.')

    return jsonResponse({
      success: true,
      enabled: Boolean(setting?.is_enabled),
      freeTierOnly: setting?.free_tier_only ?? true,
      configured: Boolean(Deno.env.get('GEMINI_API_KEY')),
      policyVersion: setting?.policy_version ?? null,
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'AI durum kontrolü başarısız oldu.'
    return jsonResponse({ success: false, error: message }, 400)
  }
})

