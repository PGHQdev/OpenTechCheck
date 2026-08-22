import { expect, test } from 'bun:test'
import { extractSignals } from '../src/extract'

const HTML = `<!doctype html><html><head>
<meta name="generator" content="WordPress 6.5" />
<meta property="og:site_name" content="Example" />
<script src="/wp-includes/js/jquery.js"></script>
<script src='https://cdn.shopify.com/x.js'></script>
</head><body></body></html>`

test('extracts script srcs', () => {
  const b = extractSignals('https://a.com', HTML, new Headers())
  expect(b.scripts).toEqual(['/wp-includes/js/jquery.js', 'https://cdn.shopify.com/x.js'])
})

test('extracts meta by lowercase name and property', () => {
  const b = extractSignals('https://a.com', HTML, new Headers())
  expect(b.meta?.['generator']).toEqual(['WordPress 6.5'])
  expect(b.meta?.['og:site_name']).toEqual(['Example'])
})

test('lowercases header names and splits set-cookie into cookies', () => {
  const h = new Headers()
  h.append('Server', 'cloudflare')
  h.append('Set-Cookie', '_shopify_s=abc; Path=/; HttpOnly')
  const b = extractSignals('https://a.com', '<html></html>', h)
  expect(b.headers?.['server']).toEqual(['cloudflare'])
  expect(b.cookies?.['_shopify_s']).toBe('abc')
})

test('keeps raw html', () => {
  const b = extractSignals('https://a.com', HTML, new Headers())
  expect(b.html).toContain('WordPress 6.5')
})

test('does not match data-src for script src', () => {
  const html = `<script data-src="placeholder.js" src="real.js"></script>`
  const b = extractSignals('https://a.com', html, new Headers())
  expect(b.scripts).toEqual(['real.js'])
})

test('does not match name inside attribute value', () => {
  const html = `<meta content="name=foo" name="generator" />`
  const b = extractSignals('https://a.com', html, new Headers())
  expect(b.meta?.['generator']).toEqual(['name=foo'])
})
