import { expect, test } from 'bun:test'
import { Window } from 'happy-dom'
import { collectSignals, sanitizeJsPayload } from '../src/content/collect'

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
