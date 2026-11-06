import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'
import { legacyEntryCompatibility } from '../build/legacyEntryCompatibility.ts'

test('compatibility entries point at the actual generated JS and CSS with origin-absolute URLs', () => {
  const plugin = legacyEntryCompatibility()
  const emitted: Array<{ fileName: string; source: string }> = []
  const hook = plugin.generateBundle
  assert.equal(typeof hook, 'function')
  if (typeof hook !== 'function') throw new Error('Expected generateBundle function')
  hook.call({ emitFile: file => emitted.push(file), error: message => { throw new Error(message) } }, {}, {
    'assets/index-new.js': { type: 'chunk', isEntry: true, fileName: 'assets/index-new.js' },
    'assets/index-new.css': { type: 'asset', fileName: 'assets/index-new.css' },
  }, false)
  assert.deepEqual(emitted, [
    { type: 'asset', fileName: '_mupsa/entry.js', source: 'import "/assets/index-new.js";\n' },
    { type: 'asset', fileName: '_mupsa/style.css', source: '@import url("/assets/index-new.css");\n' },
  ])
})

test('compatibility build fails rather than silently selecting a wrong entry after code splitting changes', () => {
  const hook = legacyEntryCompatibility().generateBundle
  if (typeof hook !== 'function') throw new Error('Expected generateBundle function')
  assert.throws(() => hook.call({ error: message => { throw new Error(message) } }, {}, {}, false), /expects one application entry/)
})

test('only known entry filename shapes receive compatibility aliases; APIs and missing files do not get SPA HTML', async () => {
  const config = JSON.parse(await readFile(new URL('../vercel.json', import.meta.url), 'utf8'))
  const entryRules = config.rewrites.filter(rule => rule.destination.startsWith('/_mupsa/'))
  const target = path => entryRules.find(rule => new RegExp(`^${rule.source}$`).test(path))?.destination
  assert.equal(target('/assets/index-DlZSv3fr.js'), '/_mupsa/entry.js')
  assert.equal(target('/assets/index-BbJ-skmL.js'), '/_mupsa/entry.js')
  assert.equal(target('/assets/index-DJag-tWX.css'), '/_mupsa/style.css')
  for (const path of ['/assets/unknown.js', '/assets/index-old.js.map', '/api/test', '/sw.js', '/other/index-old.js']) {
    assert.equal(target(path), undefined)
  }
  assert.equal(config.rewrites.some(rule => rule.source === '/(.*)'), false)
  assert.equal(config.rewrites.find(rule => rule.source === '/app/:path*')?.destination, '/index.html')
})
