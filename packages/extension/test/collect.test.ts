import { expect, test } from 'bun:test'
import { Window } from 'happy-dom'
import { collectSignals } from '../src/content/collect'

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
