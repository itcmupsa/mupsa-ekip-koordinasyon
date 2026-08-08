import { serve } from 'https://deno.land/std@0.192.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface CreateUserRequest {
  fullName: string
  email: string
  password: string
  coordinatorRoleId: string
  appRole: 'coordinator' | 'super_admin'
}

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) throw new Error('Yetkilendirme başlığı eksik.')

    const supabaseUrl = Deno.env.get('SUPABASE_URL')
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
    if (!supabaseUrl || !serviceRoleKey) {
      throw new Error('Sunucu yapılandırması eksik.')
    }

    const accessToken = authHeader.replace(/^Bearer\s+/i, '').trim()
    if (!accessToken) throw new Error('Oturum belirteci eksik.')

    const adminClient = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    })

    const { data: userData, error: userError } = await adminClient.auth.getUser(accessToken)
    if (userError || !userData.user) throw new Error('Geçersiz oturum.')

    const { data: callerMembership, error: membershipError } = await adminClient
      .from('period_memberships')
      .select('period_id, periods!inner(id, is_active)')
      .eq('profile_id', userData.user.id)
      .eq('app_role', 'super_admin')
      .eq('is_active', true)
      .eq('periods.is_active', true)
      .maybeSingle()

    if (membershipError || !callerMembership) {
      throw new Error('Bu işlem için aktif Süper Yönetici yetkisi gerekir.')
    }

    const body = (await req.json()) as Partial<CreateUserRequest>
    const fullName = typeof body.fullName === 'string' ? body.fullName.trim() : ''
    const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : ''
    const password = typeof body.password === 'string' ? body.password : ''
    const coordinatorRoleId =
      typeof body.coordinatorRoleId === 'string' ? body.coordinatorRoleId.trim() : ''
    const appRole = body.appRole

    if (!fullName) throw new Error('Ad soyad boş olamaz.')
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      throw new Error('Geçerli bir e-posta adresi girin.')
    }
    if (password.length < 8) throw new Error('Şifre en az 8 karakter olmalıdır.')
    if (appRole !== 'coordinator' && appRole !== 'super_admin') {
      throw new Error('Geçersiz uygulama rolü.')
    }
    if (!coordinatorRoleId) throw new Error('Koordinatörlük seçilmelidir.')

    const { data: roleData, error: roleError } = await adminClient
      .from('coordinator_roles')
      .select('id, is_active')
      .eq('id', coordinatorRoleId)
      .maybeSingle()
    if (roleError || !roleData || !roleData.is_active) {
      throw new Error('Seçilen koordinatörlük bulunamadı veya pasif durumda.')
    }

    const { data: newUserData, error: createError } = await adminClient.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { display_name: fullName },
    })
    if (createError || !newUserData.user) {
      throw new Error(`Kullanıcı oluşturulamadı: ${createError?.message ?? 'Bilinmeyen hata'}`)
    }

    const newUserId = newUserData.user.id
    const { error: insertError } = await adminClient.from('period_memberships').insert({
      period_id: callerMembership.period_id,
      profile_id: newUserId,
      coordinator_role_id: coordinatorRoleId,
      app_role: appRole,
      is_active: true,
    })

    if (insertError) {
      await adminClient.auth.admin.deleteUser(newUserId)
      throw new Error('Üyelik atanamadı; oluşturulan hesap geri alındı.')
    }

    return new Response(
      JSON.stringify({ success: true, message: 'Kullanıcı ve dönem üyeliği oluşturuldu.' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 },
    )
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Sunucu işlemi başarısız oldu.'
    return new Response(JSON.stringify({ success: false, error: message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 400,
    })
  }
})
