import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import ts from 'typescript'

async function loadPanel(path) {
  const source = await readFile(new URL(path, import.meta.url), 'utf8')
  const compiled = ts.transpileModule(source, {
    compilerOptions: { jsx: ts.JsxEmit.ReactJSX, module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
  }).outputText.replace(/from ['"]([^'"]+)['"]/g, (_, name) => `from ${JSON.stringify(import.meta.resolve(name))}`)
  return (await import(`data:text/javascript;base64,${Buffer.from(compiled).toString('base64')}`)).default
}
const TaskPanel = await loadPanel('../src/components/tasks/NewTaskPanel.tsx')
const EventPanel = await loadPanel('../src/components/events/NewEventPanel.tsx')
const taskProps = {
  isOpen: true, isSuperAdmin: true, contextSelection: 'standalone', title: 'Deneme', description: '',
  deadline: '', priority: 'normal', primaryProfileId: '', supportingProfileId: '', informedProfileId: '',
  events: [], awarenessPosts: [], members: [], priorities: [], error: null,
  contextKeyFor: (kind, id) => `${kind}:${id}`, onSubmit() {}, onClose() {},
}
const eventProps = {
  isOpen: true, title: 'Deneme', description: '', planningDate: '2026-10-01', estimatedDate: '',
  preparationStartDate: '', coordinatorOptions: [], hasSharedCoordinator: false,
  selectedCoordinatorProfileIds: [], error: null, onSubmit() {}, onClose() {},
}

test('task creation cannot be dismissed or edited while its save is pending', () => {
  const html = renderToStaticMarkup(createElement(TaskPanel, { ...taskProps, saving: true }))
  const closeButtons = html.match(/<button[^>]*aria-label="(?:Kapat|Yeni görev panelini kapat)"[^>]*>/g)
  assert.equal(closeButtons.length, 2)
  assert.ok(closeButtons.every(button => button.includes('disabled=""')))
  assert.match(html, /<fieldset disabled=""/)
  assert.match(html, /<button[^>]*disabled=""[^>]*>İptal<\/button>/)
})

test('task creation controls are available again when no save is pending', () => {
  const html = renderToStaticMarkup(createElement(TaskPanel, { ...taskProps, saving: false }))
  assert.doesNotMatch(html, /<fieldset disabled=""/)
  const submitButton = html.match(/<button type="submit"[^>]*>/)?.[0]
  assert.ok(submitButton)
  assert.equal(submitButton.includes('disabled=""'), false)
})

test('event creation disables every dismiss control while submitting', () => {
  const html = renderToStaticMarkup(createElement(EventPanel, { ...eventProps, submitting: true }))
  const closeButtons = html.match(/<button[^>]*aria-label="[^"]*kapat"[^>]*>/g)
  assert.ok(closeButtons.length > 0)
  assert.ok(closeButtons.every(button => button.includes('disabled=""')))
})
