import { createClient } from 'npm:@supabase/supabase-js@2.111.0'
import webpush from 'npm:web-push@3.6.7'

interface PushNotificationRow {
  id: string
  recipient_id: string
  event_id: string | null
  task_id: string | null
  title: string
  body: string
  metadata: Record<string, unknown>
}

interface PushSubscriptionRow {
  id: string
  endpoint: string
  p256dh_key: string
  auth_key: string
  content_encoding: string
}

interface PushPayload {
  title: string
  body: string
  icon: string
  badge: string
  tag: string
  data: {
    url: string
    eventId: string | null
    taskId: string | null
    calendarEntryId: string | null
  }
}

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'content-type, x-push-dispatch-secret',
}

function isExpiredSubscriptionError(error: unknown): boolean {
  const statusCode = (error as { statusCode?: number }).statusCode
  return statusCode === 404 || statusCode === 410
}

Deno.serve(async (request: Request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  const dispatchSecret = Deno.env.get('PUSH_DISPATCH_SECRET')
  if (!dispatchSecret || request.headers.get('x-push-dispatch-secret') !== dispatchSecret) {
    return new Response(JSON.stringify({ error: 'Yetkisiz bildirim teslim isteği.' }), {
      status: 401,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  const vapidSubject = Deno.env.get('VAPID_SUBJECT')
  const vapidPublicKey = Deno.env.get('VAPID_PUBLIC_KEY')
  const vapidPrivateKey = Deno.env.get('VAPID_PRIVATE_KEY')
  if (!supabaseUrl || !serviceRoleKey || !vapidSubject || !vapidPublicKey || !vapidPrivateKey) {
    return new Response(JSON.stringify({ error: 'Push teslim yapılandırması eksik.' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  webpush.setVapidDetails(vapidSubject, vapidPublicKey, vapidPrivateKey)
  const adminClient = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })

  const { data: notifications, error: notificationError } = await adminClient
    .from('notifications')
    .select('id, recipient_id, event_id, task_id, title, body, metadata')
    .eq('channel', 'push')
    .eq('delivery_status', 'queued')
    .lte('scheduled_for', new Date().toISOString())
    .order('scheduled_for', { ascending: true })
    .limit(50)

  if (notificationError) {
    return new Response(JSON.stringify({ error: notificationError.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  let sent = 0
  let failed = 0
  for (const notification of (notifications ?? []) as PushNotificationRow[]) {
    const { data: subscriptions, error: subscriptionError } = await adminClient
      .from('push_subscriptions')
      .select('id, endpoint, p256dh_key, auth_key, content_encoding')
      .eq('profile_id', notification.recipient_id)
      .eq('is_active', true)

    if (subscriptionError) {
      failed += 1
      continue
    }

    const payload: PushPayload = {
      title: notification.title,
      body: notification.body,
      icon: '/icon-192.png',
      badge: '/favicon.png',
      tag: notification.id,
      data: {
        url: typeof notification.metadata?.url === 'string' && notification.metadata.url.startsWith('/app/')
          ? notification.metadata.url
          : notification.event_id ? `/app/etkinlikler/${notification.event_id}` : '/app',
        eventId: notification.event_id,
        taskId: notification.task_id,
        calendarEntryId: typeof notification.metadata?.calendar_entry_id === 'string'
          ? notification.metadata.calendar_entry_id
          : null,
      },
    }

    let delivered = false
    for (const subscription of (subscriptions ?? []) as PushSubscriptionRow[]) {
      try {
        await webpush.sendNotification(
          {
            endpoint: subscription.endpoint,
            keys: { p256dh: subscription.p256dh_key, auth: subscription.auth_key },
          },
          JSON.stringify(payload),
          { contentEncoding: subscription.content_encoding },
        )
        delivered = true
      } catch (error) {
        if (isExpiredSubscriptionError(error)) {
          await adminClient
            .from('push_subscriptions')
            .update({ is_active: false, failed_at: new Date().toISOString() })
            .eq('id', subscription.id)
        }
      }
    }

    if (delivered) {
      await adminClient
        .from('notifications')
        .update({ delivery_status: 'sent', sent_at: new Date().toISOString() })
        .eq('id', notification.id)
      sent += 1
    } else {
      await adminClient
        .from('notifications')
        .update({ delivery_status: 'failed', metadata: { ...notification.metadata, delivery_error: 'Aktif cihaz aboneliği bulunamadı veya teslim başarısız oldu.' } })
        .eq('id', notification.id)
      failed += 1
    }
  }

  return new Response(JSON.stringify({ processed: (notifications ?? []).length, sent, failed }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
})
