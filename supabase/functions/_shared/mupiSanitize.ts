const EMAIL_RE = /[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}/g
const URL_RE = /https?:\/\/\S+/gi
const PHONE_RE = /\+?\d[\d\s().-]{8,}\d/g

export function sanitizeMupiText(value: unknown, maxLength = 180): string {
  if (typeof value !== 'string') return ''
  return value
    .replace(EMAIL_RE, '[e-posta kaldirildi]')
    .replace(URL_RE, '[baglanti kaldirildi]')
    .replace(PHONE_RE, '[telefon kaldirildi]')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, maxLength)
}

export function sanitizeMupiFacts(value: Record<string, unknown>): Record<string, unknown> {
  const result: Record<string, unknown> = {}
  for (const [key, raw] of Object.entries(value)) {
    if (typeof raw === 'string') result[key] = sanitizeMupiText(raw, 120)
    else if (typeof raw === 'number' || typeof raw === 'boolean' || raw === null) result[key] = raw
    else if (Array.isArray(raw)) {
      result[key] = raw.slice(0, 10).map((item) => typeof item === 'string' ? sanitizeMupiText(item, 80) : item)
    }
  }
  return result
}
