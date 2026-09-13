export const DEFAULT_BRAND_COLOR = '#0F6B5C'

export interface BrandTheme {
  color: string
  brand: string
  dark: string
  soft: string
}

export interface SerialTaskQueue {
  enqueue<T>(task: () => PromiseLike<T>): Promise<T>
}

export function isHexColor(value: string): boolean {
  return /^#[0-9a-f]{6}$/i.test(value)
}

export function normalizeHexColor(value: string): string | null {
  const normalized = value.trim().toUpperCase()
  return isHexColor(normalized) ? normalized : null
}

export function hexToRgb(value: string): [number, number, number] {
  const color = normalizeHexColor(value)
  if (!color) throw new Error('Geçerli bir hex renk gerekli.')
  return [
    Number.parseInt(color.slice(1, 3), 16),
    Number.parseInt(color.slice(3, 5), 16),
    Number.parseInt(color.slice(5, 7), 16),
  ]
}

function channelToLinear(channel: number): number {
  const value = channel / 255
  return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4
}

export function relativeLuminance(value: string): number {
  const [red, green, blue] = hexToRgb(value)
  return 0.2126 * channelToLinear(red) + 0.7152 * channelToLinear(green) + 0.0722 * channelToLinear(blue)
}

export function contrastRatio(first: string, second: string): number {
  const [lighter, darker] = [relativeLuminance(first), relativeLuminance(second)].sort((a, b) => b - a)
  return (lighter + 0.05) / (darker + 0.05)
}

function rgbToHex([red, green, blue]: [number, number, number]): string {
  return `#${[red, green, blue].map((channel) => Math.round(channel).toString(16).padStart(2, '0')).join('').toUpperCase()}`
}

function mix(first: string, second: string, firstWeight: number): string {
  const firstRgb = hexToRgb(first)
  const secondRgb = hexToRgb(second)
  return rgbToHex(firstRgb.map((channel, index) => channel * firstWeight + secondRgb[index] * (1 - firstWeight)) as [number, number, number])
}

/** Keeps white button labels readable while retaining the selected hue. */
export function accessibleBrandColor(value: string): string {
  const color = normalizeHexColor(value) ?? DEFAULT_BRAND_COLOR
  if (contrastRatio(color, '#FFFFFF') >= 4.5) return color

  let low = 0
  let high = 1
  for (let step = 0; step < 18; step += 1) {
    const amount = (low + high) / 2
    const candidate = mix(color, '#000000', amount)
    if (contrastRatio(candidate, '#FFFFFF') >= 4.5) low = amount
    else high = amount
  }
  return mix(color, '#000000', low)
}

export function createBrandTheme(value: string): BrandTheme {
  const color = normalizeHexColor(value) ?? DEFAULT_BRAND_COLOR
  if (color === DEFAULT_BRAND_COLOR) {
    return { color, brand: DEFAULT_BRAND_COLOR, dark: '#0B5347', soft: '#E4EFEC' }
  }
  const brand = accessibleBrandColor(color)
  return { color, brand, dark: mix(brand, '#000000', 0.78), soft: mix(brand, '#FFFFFF', 0.1) }
}

export function rgbCssValue(value: string): string {
  return hexToRgb(value).join(' ')
}

export function compositeForeground(foreground: string, background: string, opacity: number): string {
  return mix(foreground, background, opacity)
}

export function createSerialTaskQueue(): SerialTaskQueue {
  let tail: Promise<unknown> = Promise.resolve()
  return {
    enqueue<T>(task: () => PromiseLike<T>): Promise<T> {
      const result = tail.then(task, task)
      tail = result.then(() => undefined, () => undefined)
      return result
    },
  }
}
