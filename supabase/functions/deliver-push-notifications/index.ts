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

interface WebPushError {
  statusCode?: number
  message?: string
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

function isTransientSubscriptionError(error: unknown): boolean {
  const statusCode = (error as WebPushError).statusCode
  return statusCode === undefined || statusCode === 408 || statusCode === 425 || statusCode === 429 || statusCode >= 500
}

function pushErrorCode(error: unknown): string {
  const statusCode = (error as WebPushError).statusCode
  return statusCode ? `web_push_${statusCode}` : 'web_push_network_error'
}

const retryDelaysMinutes = [1, 5, 15]

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
  let retried = 0
  for (const notification of (notifications ?? []) as PushNotificationRow[]) {
    const { data: subscriptions, error: subscriptionError } = await adminClient
      .from('push_subscriptions')
      .select('id, endpoint, p256dh_key, auth_key, content_encoding')
      .eq('profile_id', notification.recipient_id)
      .eq('is_active', true)

    if (subscriptionError) {
      const currentRetryCount = typeof notification.metadata?.push_retry_count === 'number'
        ? notification.metadata.push_retry_count
        : 0
      const nextRetryCount = currentRetryCount + 1
      const shouldRetry = nextRetryCount <= retryDelaysMinutes.length
      await adminClient
        .from('notifications')
        .update({
          delivery_status: shouldRetry ? 'queued' : 'failed',
          ...(shouldRetry
            ? { scheduled_for: new Date(Date.now() + retryDelaysMinutes[nextRetryCount - 1] * 60_000).toISOString() }
            : {}),
          metadata: {
            ...notification.metadata,
            push_retry_count: nextRetryCount,
            delivery_error_code: 'subscription_lookup_failed',
            delivery_error: subscriptionError.message.slice(0, 300),
          },
        })
        .eq('id', notification.id)
      if (shouldRetry) retried += 1
      else failed += 1
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
    let transientFailure = false
    let lastErrorCode: string | null = null
    let lastErrorMessage: string | null = null
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
        lastErrorCode = pushErrorCode(error)
        lastErrorMessage = error instanceof Error ? error.message.slice(0, 300) : 'Bilinmeyen Web Push hatası.'
        if (isExpiredSubscriptionError(error)) {
          await adminClient
            .from('push_subscriptions')
            .update({ is_active: false, failed_at: new Date().toISOString() })
            .eq('id', subscription.id)
        } else if (isTransientSubscriptionError(error)) {
          transientFailure = true
        }
      }
    }

    if (delivered) {
      await adminClient
        .from('notifications')
        .update({ delivery_status: 'sent', sent_at: new Date().toISOString() })
        .eq('id', notification.id)
      sent += 1
    } else if (transientFailure) {
      const currentRetryCount = typeof notification.metadata?.push_retry_count === 'number'
        ? notification.metadata.push_retry_count
        : 0
      const nextRetryCount = currentRetryCount + 1
      if (nextRetryCount <= retryDelaysMinutes.length) {
        await adminClient
          .from('notifications')
          .update({
            delivery_status: 'queued',
            scheduled_for: new Date(Date.now() + retryDelaysMinutes[nextRetryCount - 1] * 60_000).toISOString(),
            metadata: {
              ...notification.metadata,
              push_retry_count: nextRetryCount,
              delivery_error_code: lastErrorCode,
              delivery_error: lastErrorMessage,
            },
          })
          .eq('id', notification.id)
        retried += 1
      } else {
        await adminClient
          .from('notifications')
          .update({
            delivery_status: 'failed',
            metadata: {
              ...notification.metadata,
              push_retry_count: nextRetryCount,
              delivery_error_code: lastErrorCode ?? 'push_retry_exhausted',
              delivery_error: lastErrorMessage ?? 'Push bildirimi tekrar denemelerine rağmen teslim edilemedi.',
            },
          })
          .eq('id', notification.id)
        failed += 1
      }
    } else {
      const hasSubscriptions = (subscriptions ?? []).length > 0
      await adminClient
        .from('notifications')
        .update({
          delivery_status: 'failed',
          metadata: {
            ...notification.metadata,
            delivery_error_code: hasSubscriptions ? (lastErrorCode ?? 'push_delivery_rejected') : 'no_active_subscription',
            delivery_error: hasSubscriptions
              ? (lastErrorMessage ?? 'Aktif cihaz aboneliğine teslim başarısız oldu.')
              : 'Kullanıcının aktif PWA bildirim aboneliği bulunmuyor.',
          },
        })
        .eq('id', notification.id)
      failed += 1
    }
  }

  return new Response(JSON.stringify({ processed: (notifications ?? []).length, sent, failed, retried }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
})
