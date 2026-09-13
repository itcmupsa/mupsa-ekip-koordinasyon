import assert from 'node:assert/strict'
import test from 'node:test'
import {
  accessibleBrandColor,
  contrastRatio,
  createBrandTheme,
  createSerialTaskQueue,
  DEFAULT_BRAND_COLOR,
  normalizeHexColor,
} from '../src/lib/theme.ts'

test('the existing green theme keeps its established palette', () => {
  assert.deepEqual(createBrandTheme(DEFAULT_BRAND_COLOR), {
    color: '#0F6B5C', brand: '#0F6B5C', dark: '#0B5347', soft: '#E4EFEC',
  })
})

test('invalid custom colors are rejected', () => {
  assert.equal(normalizeHexColor('#12FG00'), null)
  assert.equal(normalizeHexColor('#123'), null)
  assert.equal(normalizeHexColor(' #0f6b5c '), '#0F6B5C')
})

test('extreme custom colors preserve readable white text on brand surfaces', () => {
  for (const color of ['#000000', '#FFFFFF', '#FF0000', '#00FF00', '#0000FF', '#FFFF00', '#00FFFF', '#FF00FF', '#808080']) {
    const theme = createBrandTheme(color)
    assert.ok(contrastRatio(theme.brand, '#FFFFFF') >= 4.5, `${color} brand contrast`)
    assert.ok(contrastRatio(theme.dark, '#FFFFFF') >= 4.5, `${color} dark contrast`)
    assert.equal(accessibleBrandColor(color), theme.brand)
  }
})

test('serial task queue keeps database writes in user request order', async () => {
  const queue = createSerialTaskQueue()
  const order: string[] = []
  let releaseFirst: (() => void) | undefined
  const firstGate = new Promise<void>((resolve) => { releaseFirst = resolve })

  const first = queue.enqueue(async () => {
    order.push('first-start')
    await firstGate
    order.push('first-end')
  })
  const second = queue.enqueue(async () => {
    order.push('second-start')
    order.push('second-end')
  })

  await Promise.resolve()
  assert.deepEqual(order, ['first-start'])
  releaseFirst?.()
  await Promise.all([first, second])
  assert.deepEqual(order, ['first-start', 'first-end', 'second-start', 'second-end'])
})
