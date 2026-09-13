const APP_ORIGIN = 'https://mupsa.local'
const DEFAULT_RETURN_TO = '/app'

export function safeAppReturnTo(value: string | null | undefined): string {
  if (!value) return DEFAULT_RETURN_TO

  try {
    const target = new URL(value, APP_ORIGIN)
    if (target.origin !== APP_ORIGIN) return DEFAULT_RETURN_TO
    if (target.pathname !== '/app' && !target.pathname.startsWith('/app/')) return DEFAULT_RETURN_TO
    return `${target.pathname}${target.search}${target.hash}`
  } catch {
    return DEFAULT_RETURN_TO
  }
}

export function loginPathFor(returnTo: string): string {
  return `/login?returnTo=${encodeURIComponent(safeAppReturnTo(returnTo))}`
}
