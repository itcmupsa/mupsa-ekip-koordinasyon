export interface WebPushErrorLike {
  statusCode?: number
}

export interface PushPayloadInput {
  notificationId: string
  title: string
  body: string
  eventId: string | null
  taskId: string | null
  metadata: Record<string, unknown>
}

export interface PushPayload {
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

export const WEB_PUSH_TTL_SECONDS = 28 * 24 * 60 * 60

export const RETRY_DELAYS_SECONDS = [
  60,
  5 * 60,
  15 * 60,
  60 * 60,
  6 * 60 * 60,
  24 * 60 * 60,
  48 * 60 * 60,
  96 * 60 * 60,
  7 * 24 * 60 * 60,
] as const

export const MAX_PUSH_PAYLOAD_BYTES = 3000
const textEncoder = new TextEncoder()

export function isExpiredSubscriptionError(error: unknown): boolean {
  const statusCode = (error as WebPushErrorLike)?.statusCode
  return statusCode === 404 || statusCode === 410
}

export function isTransientSubscriptionError(error: unknown): boolean {
  const statusCode = (error as WebPushErrorLike)?.statusCode
  return statusCode === undefined || statusCode === 408 || statusCode === 425 || statusCode === 429 || statusCode >= 500
}

export function pushErrorCode(error: unknown): string {
  const statusCode = (error as WebPushErrorLike)?.statusCode
  return statusCode ? `web_push_${statusCode}` : 'web_push_network_error'
}

export function safeAppUrl(value: unknown, eventId: string | null): string {
  if (typeof value === 'string' && (value === '/app' || value.startsWith('/app/'))) return value
  return eventId ? `/app/etkinlikler/${eventId}` : '/app'
}

export function payloadBytes(payload: PushPayload): number {
  return textEncoder.encode(JSON.stringify(payload)).byteLength
}

export function buildSafePayload(input: PushPayloadInput): PushPayload {
  const basePayload: PushPayload = {
    title: input.title,
    body: input.body,
    icon: '/icon-192.png',
    badge: '/favicon.png',
    tag: input.notificationId,
    data: {
      url: safeAppUrl(input.metadata?.url, input.eventId),
      eventId: input.eventId,
      taskId: input.taskId,
      calendarEntryId: typeof input.metadata?.calendar_entry_id === 'string'
        ? input.metadata.calendar_entry_id
        : null,
    },
  }

  if (payloadBytes(basePayload) <= MAX_PUSH_PAYLOAD_BYTES) return basePayload

  const characters = Array.from(input.body)
  let low = 0
  let high = characters.length
  let best = ''
  while (low <= high) {
    const middle = Math.floor((low + high) / 2)
    const candidateBody = middle < characters.length
      ? `${characters.slice(0, middle).join('')}…`
      : characters.join('')
    const candidate = { ...basePayload, body: candidateBody }
    if (payloadBytes(candidate) <= MAX_PUSH_PAYLOAD_BYTES) {
      best = candidateBody
      low = middle + 1
    } else {
      high = middle - 1
    }
  }

  return { ...basePayload, body: best || 'Yeni bir bildirimin var.' }
}
