import { createClient } from 'npm:@supabase/supabase-js@2.111.0'
import webpush from 'npm:web-push@3.6.7'
import {
  buildSafePayload,
  isExpiredSubscriptionError,
  isTransientSubscriptionError,
  pushErrorCode,
  RETRY_DELAYS_SECONDS,
  WEB_PUSH_TTL_SECONDS,
} from '../_shared/pushDeliveryPolicy.ts'

interface ClaimedPushDeliveryRow {
  delivery_id: string
  delivery_claim_token: string
  notification_id: string
  recipient_id: string
  event_id: string | null
  task_id: string | null
  title: string
  body: string
  metadata: Record<string, unknown>
  subscription_id: string
  endpoint: string
  p256dh_key: string
  auth_key: string
  content_encoding: string
  attempt_count: number
}

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'content-type, x-push-dispatch-secret',
}

Deno.serve(async (request: Request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  const dispatchSecret = Deno.env.get('PUSH_DISPATCH_SECRET')
  if (!dispatchSecret || request.headers.get('x-push-dispatch-secret') !== dispatchSecret) {
    return new Response(JSON.stringify({ error: 'Yetkisiz bildirim teslim istegi.' }), {
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
    return new Response(JSON.stringify({ error: 'Push teslim yapilandirmasi eksik.' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  webpush.setVapidDetails(vapidSubject, vapidPublicKey, vapidPrivateKey)
  const adminClient = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })

  const { data: claimedRows, error: claimError } = await adminClient.rpc(
    'claim_push_notification_deliveries',
    { p_limit: 50 },
  )

  if (claimError) {
    return new Response(JSON.stringify({ error: claimError.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  const deliveries = (claimedRows ?? []) as ClaimedPushDeliveryRow[]
  let sent = 0
  let failed = 0
  let retried = 0
  let finalizeErrors = 0

  for (const delivery of deliveries) {
    const payload = buildSafePayload({
      notificationId: delivery.notification_id,
      title: delivery.title,
      body: delivery.body,
      eventId: delivery.event_id,
      taskId: delivery.task_id,
      metadata: delivery.metadata,
    })

    try {
      await webpush.sendNotification(
        {
          endpoint: delivery.endpoint,
          keys: { p256dh: delivery.p256dh_key, auth: delivery.auth_key },
        },
        JSON.stringify(payload),
        {
          contentEncoding: delivery.content_encoding,
          TTL: WEB_PUSH_TTL_SECONDS,
        },
      )

      const { data: finalized, error: finalizeError } = await adminClient.rpc(
        'finish_push_notification_delivery',
        {
          p_delivery_id: delivery.delivery_id,
          p_claim_token: delivery.delivery_claim_token,
          p_outcome: 'sent',
          p_next_attempt_at: null,
          p_error_code: null,
          p_error: null,
        },
      )

      if (finalizeError || finalized !== true) finalizeErrors += 1
      else sent += 1
    } catch (error) {
      const errorCode = pushErrorCode(error)
      const errorMessage = error instanceof Error ? error.message.slice(0, 300) : 'Bilinmeyen Web Push hatasi.'

      if (isExpiredSubscriptionError(error)) {
        await adminClient
          .from('push_subscriptions')
          .update({ is_active: false, failed_at: new Date().toISOString() })
          .eq('id', delivery.subscription_id)

        const { data: finalized, error: finalizeError } = await adminClient.rpc(
          'finish_push_notification_delivery',
          {
            p_delivery_id: delivery.delivery_id,
            p_claim_token: delivery.delivery_claim_token,
            p_outcome: 'permanent_failed',
            p_next_attempt_at: null,
            p_error_code: errorCode,
            p_error: errorMessage,
          },
        )
        if (finalizeError || finalized !== true) finalizeErrors += 1
        else failed += 1
        continue
      }

      if (isTransientSubscriptionError(error) && delivery.attempt_count <= RETRY_DELAYS_SECONDS.length) {
        const retryDelaySeconds = RETRY_DELAYS_SECONDS[delivery.attempt_count - 1]
        const nextAttemptAt = new Date(Date.now() + retryDelaySeconds * 1000).toISOString()
        const { data: finalized, error: finalizeError } = await adminClient.rpc(
          'finish_push_notification_delivery',
          {
            p_delivery_id: delivery.delivery_id,
            p_claim_token: delivery.delivery_claim_token,
            p_outcome: 'transient_failed',
            p_next_attempt_at: nextAttemptAt,
            p_error_code: errorCode,
            p_error: errorMessage,
          },
        )
        if (finalizeError || finalized !== true) finalizeErrors += 1
        else retried += 1
        continue
      }

      const exhaustedCode = isTransientSubscriptionError(error) ? 'push_retry_exhausted' : errorCode
      const { data: finalized, error: finalizeError } = await adminClient.rpc(
        'finish_push_notification_delivery',
        {
          p_delivery_id: delivery.delivery_id,
          p_claim_token: delivery.delivery_claim_token,
          p_outcome: 'permanent_failed',
          p_next_attempt_at: null,
          p_error_code: exhaustedCode,
          p_error: errorMessage,
        },
      )
      if (finalizeError || finalized !== true) finalizeErrors += 1
      else failed += 1
    }
  }

  const responseStatus = finalizeErrors > 0 ? 500 : 200
  return new Response(JSON.stringify({
    processed: deliveries.length,
    sent,
    failed,
    retried,
    finalize_errors: finalizeErrors,
    ttl_seconds: WEB_PUSH_TTL_SECONDS,
  }), {
    status: responseStatus,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
})
