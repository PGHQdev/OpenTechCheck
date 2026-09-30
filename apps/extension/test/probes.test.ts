import { expect, test } from 'bun:test'
import { Window } from 'happy-dom'
import { runProbes } from '../src/main-world/probes'

function windowWithBody(html: string) {
  const w = new Window()
  w.document.write(`<html><body>${html}</body></html>`)
  return w
}

test('detects react from a fiber marker, no version available', async () => {
  const w = windowWithBody('<div id="app"></div>')
  const el = w.document.getElementById('app') as unknown as Record<string, unknown>
  el['__reactFiber$abc123'] = {}
  const out = (await runProbes(w.document as unknown as Document, w as unknown as Window)).js
  expect(out).toEqual({ '$probe.react': 'detected' })
})

test('reports react version from window.React.version when present', async () => {
  const w = windowWithBody('<div id="app"></div>')
  const el = w.document.getElementById('app') as unknown as Record<string, unknown>
  el['__reactContainer$xyz'] = {}
  ;(w as unknown as Record<string, unknown>)['React'] = { version: '18.3.1' }
  const out = (await runProbes(w.document as unknown as Document, w as unknown as Window)).js
  expect(out['$probe.react']).toBe('18.3.1')
})

test('detects react via legacy _reactRootContainer marker', async () => {
  const w = windowWithBody('<div id="app"></div>')
  const el = w.document.getElementById('app') as unknown as Record<string, unknown>
  el['_reactRootContainer'] = {}
  const out = (await runProbes(w.document as unknown as Document, w as unknown as Window)).js
  expect(out).toEqual({ '$probe.react': 'detected' })
})

test('detects vue from __vue_app__ and reads its version', async () => {
  const w = windowWithBody('<div id="app"></div>')
  const el = w.document.getElementById('app') as unknown as Record<string, unknown>
  el['__vue_app__'] = { version: '3.4.21' }
  const out = (await runProbes(w.document as unknown as Document, w as unknown as Window)).js
  expect(out).toEqual({ '$probe.vue': '3.4.21' })
})

test('detects vue from a bare __vue__ marker with no version', async () => {
  const w = windowWithBody('<div id="app"></div>')
  const el = w.document.getElementById('app') as unknown as Record<string, unknown>
  el['__vue__'] = {}
  const out = (await runProbes(w.document as unknown as Document, w as unknown as Window)).js
  expect(out).toEqual({ '$probe.vue': 'detected' })
})

test('detects vue from a global __VUE__ flag with no element markers', async () => {
  const w = windowWithBody('<div id="app"></div>')
  ;(w as unknown as Record<string, unknown>)['__VUE__'] = true
  const out = (await runProbes(w.document as unknown as Document, w as unknown as Window)).js
  expect(out).toEqual({ '$probe.vue': 'detected' })
})

test('returns {} when no markers are present', async () => {
  const w = windowWithBody('<div id="app"></div><span></span>')
  const out = (await runProbes(w.document as unknown as Document, w as unknown as Window)).js
  expect(out).toEqual({})
})

test('detects both frameworks together', async () => {
  const w = windowWithBody('<div id="a"></div><div id="b"></div>')
  const a = w.document.getElementById('a') as unknown as Record<string, unknown>
  const b = w.document.getElementById('b') as unknown as Record<string, unknown>
  a['__reactFiber$abc'] = {}
  b['__vue_app__'] = { version: '3.4.21' }
  const out = (await runProbes(w.document as unknown as Document, w as unknown as Window)).js
  expect(out).toEqual({ '$probe.react': 'detected', '$probe.vue': '3.4.21' })
})

test('never throws on a hostile document', async () => {
  const hostileDoc = {
    querySelectorAll() { throw new Error('nope') },
  } as unknown as Document
  const result = await runProbes(hostileDoc, {})
  expect(result.js).toEqual({})
  expect(result.complete).toBe(false)
})

test('finds frameworks beyond 1500 nodes and yields during large scans', async () => {
  const w = windowWithBody('<div></div>'.repeat(4000) + '<section id="deep"></section>')
  ;(w.document.getElementById('deep') as any).__vue_app__ = { version: '3.5.0' }
  let yields = 0
  const result = await runProbes(w.document as unknown as Document, w, { yieldToPage: async () => { yields++ } })
  expect(result.js['$probe.vue']).toBe('3.5.0')
  expect(result.complete).toBe(true)
  expect(yields).toBeGreaterThan(1)
})

test('scans nested open shadow roots and Lit render-before comments', async () => {
  const w = windowWithBody('<div id="host"></div>')
  const shadow = w.document.getElementById('host')!.attachShadow({ mode: 'open' })
  shadow.innerHTML = '<div id="nested"></div>'
  const inner = shadow.querySelector('#nested')!.attachShadow({ mode: 'open' })
  const comment = w.document.createComment('')
  ;(comment as any)._$litPart$ = { type: 2 }
  inner.append(comment)
  const el = w.document.createElement('div')
  ;(el as any).__ngContext__ = 0
  inner.append(el)
  const result = await runProbes(w.document as unknown as Document, w)
  expect(result.js).toEqual({ '$probe.lit': 'detected', '$probe.angular': 'detected' })
  expect(result.complete).toBe(true)
})

test('reads Angular root version and mounted Alpine without global exports', async () => {
  const w = windowWithBody('<app-root ng-version="20.2.0"></app-root><div id="alpine"></div>')
  ;(w.document.getElementById('alpine') as any)._x_dataStack = [{}]
  const { js } = await runProbes(w.document as unknown as Document, w)
  expect(js['$probe.angular']).toBe('20.2.0')
  expect(js['$probe.alpinejs']).toBe('detected')
})

test('detects a shaped Preact root but rejects unrelated short properties', async () => {
  const w = windowWithBody('<div id="a"></div><div id="b"></div>')
  const a = w.document.getElementById('a') as any
  a.__k = { props: {}, type: 'div' }
  expect((await runProbes(w.document as unknown as Document, w)).js['$probe.preact']).toBeUndefined()
  a.__k = { __k: [], __v: 1, type: () => {}, props: {} }
  expect((await runProbes(w.document as unknown as Document, w)).js['$probe.preact']).toBe('detected')
})

test('uses Svelte disclosure and Lit HTML versions without mislabeling Lit package versions', async () => {
  const w = windowWithBody('') as any
  w.__svelte = { v: new Set(['5']) }
  w.litHtmlVersions = ['3.3.1']
  expect((await runProbes(w.document, w)).js).toEqual({ '$probe.svelte': '5', '$probe.lit': 'detected' })
  w.__svelte.v.add('4')
  expect((await runProbes(w.document, w)).js['$probe.svelte']).toBe('detected')
})

test('marker-like attributes, empty markers and getters do not manufacture runtime detections', async () => {
  const w = windowWithBody('<div id="app" __ngContext__="0" _x_dataStack="[]"></div>') as any
  const el = w.document.getElementById('app')
  let reads = 0
  Object.defineProperty(el, '__vue_app__', { get: () => { reads++; throw new Error('no') } })
  Object.defineProperty(w, '__svelte', { get: () => { reads++; return { v: new Set(['5']) } } })
  el._x_dataStack = []
  el._$litPart$ = {}
  el.__ngContext__ = 'not Angular'
  const { js } = await runProbes(w.document, w)
  expect(js).toEqual({})
  expect(reads).toBe(0)
})

test('time budget and cancellation retain positive evidence but mark scans incomplete', async () => {
  const w = windowWithBody('<div id="app"></div>' + '<div></div>'.repeat(1000))
  ;(w.document.getElementById('app') as any).__reactFiber$test = {}
  let time = 0
  const limited = await runProbes(w.document as unknown as Document, w, {
    now: () => time, yieldToPage: async () => { time = 3000 },
  })
  expect(limited.js['$probe.react']).toBe('detected')
  expect(limited.complete).toBe(false)
  const controller = new AbortController()
  controller.abort()
  expect((await runProbes(w.document as unknown as Document, w, { signal: controller.signal })).complete).toBe(false)
})
