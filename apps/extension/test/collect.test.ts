import { expect, test } from 'bun:test'
import { Window } from 'happy-dom'
import { collectSignals, sanitizeJsPayload } from '../src/content/collect'
import { CAPS } from '../src/shared/protocol'

function doc(html: string): Document {
  const w = new Window()
  w.document.write(html)
  return w.document as unknown as Document
}

test('collects meta, scripts, and matching dom selectors', () => {
  const d = doc(`<html><head>
    <meta name="Generator" content="WordPress 6.5">
    <meta property="og:title" content="x">
    <script src="https://cdn.example.com/app.js"></script>
    </head><body><div id="__next"></div></body></html>`)
  const s = collectSignals(d, 'https://example.com/', ['#__next', '#__nuxt'])
  expect(s.meta['generator']).toEqual(['WordPress 6.5'])
  expect(s.meta['og:title']).toEqual(['x'])
  expect(s.scripts).toEqual(['https://cdn.example.com/app.js'])
  expect(s.dom).toEqual(['#__next'])
  expect(s.url).toBe('https://example.com/')
})

test('caps html length and script count', () => {
  const many = Array.from({ length: 600 }, (_, i) => `<script src="/s${i}.js"></script>`).join('')
  const d = doc(`<html><body>${'x'.repeat(600_000)}${many}</body></html>`)
  const s = collectSignals(d, 'https://example.com/', [])
  expect(s.html.length).toBeLessThanOrEqual(500_000)
  expect(s.scripts.length).toBe(500)
})

test('a selector that throws is skipped', () => {
  const d = doc('<html><body></body></html>')
  const s = collectSignals(d, 'https://example.com/', ['::bogus!!', 'body'])
  expect(s.dom).toEqual(['body'])
})

test('sanitizeJsPayload drops keys not in the allowlist', () => {
  const out = sanitizeJsPayload(
    { 'next.version': '14.1.0', forged: 'x'.repeat(10), extra: 'y' },
    ['next.version'],
    200,
  )
  expect(out).toEqual({ 'next.version': '14.1.0' })
})

test('sanitizeJsPayload recaps oversized values', () => {
  const out = sanitizeJsPayload({ 'next.version': 'x'.repeat(500) }, ['next.version'], 10)
  expect(out['next.version']).toBe('x'.repeat(10))
})

test('sanitizeJsPayload returns {} for non-object input', () => {
  expect(sanitizeJsPayload(null, ['a'], 10)).toEqual({})
  expect(sanitizeJsPayload('forged', ['a'], 10)).toEqual({})
  expect(sanitizeJsPayload(42, ['a'], 10)).toEqual({})
  expect(sanitizeJsPayload(undefined, ['a'], 10)).toEqual({})
})

test('reads only the requested attributes and text, from every match', () => {
  const d = doc(`<html><body>
    <meta name="g" content="A 1" data-x="no"><meta name="g" content="B 2"><meta name="g" content="A 1">
    <footer>  Powered
      by   Foo </footer><div id="z">skip</div></body></html>`)
  const s = collectSignals(d, 'https://e.com/', ['#z', 'footer', 'meta[name="g"]'], {
    'meta[name="g"]': { attrs: ['content'], text: false },
    footer: { attrs: [], text: true },
  })
  expect(s.dom).toEqual(['#z', 'footer', 'meta[name="g"]'])
  expect(s.domAttrs).toEqual({ 'meta[name="g"]': { content: ['A 1', 'B 2'] } })
  expect(s.domText).toEqual({ footer: ['Powered by Foo'] })
})

test('caps elements per selector and characters per value', () => {
  const many = Array.from({ length: 60 }, (_, i) => `<i data-n="${i}"></i>`).join('')
  const d = doc(`<html><body>${many}<b title="${'x'.repeat(20_000)}"></b></body></html>`)
  const s = collectSignals(d, 'https://e.com/', ['b', 'i'], {
    b: { attrs: ['title'], text: false }, i: { attrs: ['data-n'], text: false },
  })
  expect(s.domAttrs.i?.['data-n']).toHaveLength(CAPS.domMatches)
  expect(s.domAttrs.b?.title?.[0]).toHaveLength(CAPS.domValue)
})

test('round-robin fill: a broad selector that sorts first does not starve a later one', () => {
  const big = Array.from({ length: 60 }, (_, i) => `<p data-v="${i}${'y'.repeat(9_990)}"></p>`).join('')
  const d = doc(`<html><body>${big}<section data-v="late"></section></body></html>`)
  const s = collectSignals(d, 'https://e.com/', ['p', 'section'], {
    p: { attrs: ['data-v'], text: false }, section: { attrs: ['data-v'], text: false },
  })
  expect(s.domAttrs.section?.['data-v']).toEqual(['late'])
  const total = Object.values(s.domAttrs).flatMap((a) => Object.values(a).flat()).reduce((n, v) => n + v.length, 0)
  expect(total).toBeLessThanOrEqual(CAPS.domTotal)
  expect(s.domAttrs.p?.['data-v']?.length).toBe(CAPS.domMatches)
})

test('the total budget cuts the last value and stops', () => {
  const els = Array.from({ length: 50 }, (_, i) => `<p data-v="${i}${'z'.repeat(9_998)}"></p><q data-v="${i}${'z'.repeat(9_998)}"></q>`).join('')
  const d = doc(`<html><body>${els}</body></html>`)
  const s = collectSignals(d, 'https://e.com/', ['p', 'q'], {
    p: { attrs: ['data-v'], text: false }, q: { attrs: ['data-v'], text: false },
  })
  const values = [...(s.domAttrs.p?.['data-v'] ?? []), ...(s.domAttrs.q?.['data-v'] ?? [])]
  expect(values.reduce((n, v) => n + v.length, 0)).toBe(CAPS.domTotal)
})
