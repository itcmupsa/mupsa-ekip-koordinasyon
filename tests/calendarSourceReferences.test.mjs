import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { MemoryRouter } from 'react-router-dom'
import ts from 'typescript'

// Compile the actual TSX component in memory; no browser, database or generated files.
const source = await readFile(new URL('../src/components/calendar/CalendarSourceReferences.tsx', import.meta.url), 'utf8')
const compiled = ts.transpileModule(source, {
  compilerOptions: { jsx: ts.JsxEmit.ReactJSX, module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
}).outputText.replace(/from ['"]([^'"]+)['"]/g, (_, name) => `from ${JSON.stringify(import.meta.resolve(name))}`)
const { SelectedSourcePanel, AwarenessRangeStrip, EventReferenceChip, AwarenessReferenceChip } =
  await import(`data:text/javascript;base64,${Buffer.from(compiled).toString('base64')}`)
const render = (component, props) => renderToStaticMarkup(
  createElement(MemoryRouter, null, createElement(component, props)),
)
const event = { id: 'event-1', title: 'Deneme etkinliği', start: '2026-10-10', typeLabel: 'Etkinlik', viewUrl: '/app/etkinlikler/event-1' }

test('a source viewer can open the event but cannot create a publication plan', () => {
  const html = render(SelectedSourcePanel, { source: event, kind: 'event', canManage: false, onCreatePlan() {} })
  assert.match(html, /href="\/app\/etkinlikler\/event-1"/)
  assert.doesNotMatch(html, /Bu kayıt için yayın planla/)
})

test('an authorized manager sees the plan action for the selected real source', () => {
  const html = render(SelectedSourcePanel, { source: event, kind: 'event', canManage: true, onCreatePlan() {} })
  assert.match(html, /Bu kayıt için yayın planla/)
  assert.match(html, /Etkinliği görüntüle/)
  assert.match(html, /aria-labelledby="selected-source-title"/)
})

test('manual source details never offer a plan with a manual UUID', () => {
  const html = render(SelectedSourcePanel, { source: { ...event, isManual: true }, kind: 'event', canManage: true, onCreatePlan() {} })
  assert.doesNotMatch(html, /Bu kayıt için yayın planla/)
})

test('the range strip renders one source and keeps the real source link', () => {
  const html = render(AwarenessRangeStrip, { title: 'Devam eden farkındalıklar', ranges: [
    { id: 'awareness-1', title: 'Deneme ayı', start: '2026-12-28', end: '2027-01-04', linkTo: '/app/farkindalik?record=awareness-1' },
  ] })
  assert.equal((html.match(/Deneme ayı/g) ?? []).length, 1)
  assert.match(html, /href="\/app\/farkindalik\?record=awareness-1"/)
  assert.match(html, /2027/)
})

test('range references without links are actionable buttons and empty strips are omitted', () => {
  assert.equal(render(AwarenessRangeStrip, { title: 'Boş', ranges: [] }), '')
  const html = render(AwarenessRangeStrip, { title: 'Aralık', ranges: [
    { id: 'awareness-1', title: 'Deneme', start: '2026-10-01', end: '2026-10-31', onClick() {} },
  ] })
  assert.match(html, /<button type="button"/)
})

test('source types have text labels as well as colours and decorative icons are hidden', () => {
  const eventHtml = render(EventReferenceChip, { title: 'Deneme', onClick() {} })
  const awarenessHtml = render(AwarenessReferenceChip, { title: 'Deneme', onClick() {} })
  assert.match(eventHtml, /Etkinlik · Deneme/)
  assert.match(awarenessHtml, /Farkındalık · Deneme/)
  assert.match(eventHtml, /aria-hidden="true"/)
  assert.match(awarenessHtml, /min-h-11/)
})
