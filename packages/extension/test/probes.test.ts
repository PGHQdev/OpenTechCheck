import { expect, test } from 'bun:test'
import { Window } from 'happy-dom'
import { runProbes } from '../src/main-world/probes'

function windowWithBody(html: string) {
  const w = new Window()
  w.document.write(`<html><body>${html}</body></html>`)
  return w
}

test('detects react from a fiber marker, no version available', () => {
  const w = windowWithBody('<div id="app"></div>')
  const el = w.document.getElementById('app') as unknown as Record<string, unknown>
  el['__reactFiber$abc123'] = {}
  const out = runProbes(w.document as unknown as Document, w as unknown as Window)
  expect(out).toEqual({ '$probe.react': 'detected' })
})

test('reports react version from window.React.version when present', () => {
  const w = windowWithBody('<div id="app"></div>')
  const el = w.document.getElementById('app') as unknown as Record<string, unknown>
  el['__reactContainer$xyz'] = {}
  ;(w as unknown as Record<string, unknown>)['React'] = { version: '18.3.1' }
  const out = runProbes(w.document as unknown as Document, w as unknown as Window)
  expect(out['$probe.react']).toBe('18.3.1')
})

test('detects react via legacy _reactRootContainer marker', () => {
  const w = windowWithBody('<div id="app"></div>')
  const el = w.document.getElementById('app') as unknown as Record<string, unknown>
  el['_reactRootContainer'] = {}
  const out = runProbes(w.document as unknown as Document, w as unknown as Window)
  expect(out).toEqual({ '$probe.react': 'detected' })
})

test('detects vue from __vue_app__ and reads its version', () => {
  const w = windowWithBody('<div id="app"></div>')
  const el = w.document.getElementById('app') as unknown as Record<string, unknown>
  el['__vue_app__'] = { version: '3.4.21' }
  const out = runProbes(w.document as unknown as Document, w as unknown as Window)
  expect(out).toEqual({ '$probe.vue': '3.4.21' })
})

test('detects vue from a bare __vue__ marker with no version', () => {
  const w = windowWithBody('<div id="app"></div>')
  const el = w.document.getElementById('app') as unknown as Record<string, unknown>
  el['__vue__'] = {}
  const out = runProbes(w.document as unknown as Document, w as unknown as Window)
  expect(out).toEqual({ '$probe.vue': 'detected' })
})

test('detects vue from a global __VUE__ flag with no element markers', () => {
  const w = windowWithBody('<div id="app"></div>')
  ;(w as unknown as Record<string, unknown>)['__VUE__'] = true
  const out = runProbes(w.document as unknown as Document, w as unknown as Window)
  expect(out).toEqual({ '$probe.vue': 'detected' })
})

test('returns {} when no markers are present', () => {
  const w = windowWithBody('<div id="app"></div><span></span>')
  const out = runProbes(w.document as unknown as Document, w as unknown as Window)
  expect(out).toEqual({})
})

test('detects both frameworks together', () => {
  const w = windowWithBody('<div id="a"></div><div id="b"></div>')
  const a = w.document.getElementById('a') as unknown as Record<string, unknown>
  const b = w.document.getElementById('b') as unknown as Record<string, unknown>
  a['__reactFiber$abc'] = {}
  b['__vue_app__'] = { version: '3.4.21' }
  const out = runProbes(w.document as unknown as Document, w as unknown as Window)
  expect(out).toEqual({ '$probe.react': 'detected', '$probe.vue': '3.4.21' })
})

test('never throws on a hostile document', () => {
  const hostileDoc = {
    querySelectorAll() { throw new Error('nope') },
  } as unknown as Document
  expect(() => runProbes(hostileDoc, {})).not.toThrow()
  expect(runProbes(hostileDoc, {})).toEqual({})
})
