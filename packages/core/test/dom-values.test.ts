import { expect, test } from 'bun:test'
import { detect } from '../src/index'
import type { Fingerprint } from '../src/index'

const fp = (dom: Fingerprint['detect']['dom']): Fingerprint => ({
  name: 'X', slug: 'x', category: 'cms', website: 'https://x.com', detect: { dom },
})

test('attr rule tests every value; the second one matches', () => {
  const f = fp({ 'meta[name="generator"]': [{ attr: 'content', pattern: 'Foo ([\\d.]+)', version: 1 }] })
  const out = detect({
    url: 'u', dom: ['meta[name="generator"]'],
    domAttrs: { 'meta[name="generator"]': { content: ['Bar 1', 'Foo 2.0'] } },
  }, [f])
  expect(out[0]?.version).toBe('2.0')
  expect(out[0]?.evidence).toEqual([{ source: 'dom', pattern: 'Foo ([\\d.]+)', match: 'Foo 2.0', key: 'meta[name="generator"]' }])
})

test('attr rule with no values for that attribute does not hit', () => {
  const f = fp({ div: [{ attr: 'data-foo', pattern: '' }] })
  expect(detect({ url: 'u', dom: ['div'], domAttrs: { div: { id: ['a'] } } }, [f])).toHaveLength(0)
  expect(detect({ url: 'u', dom: ['div'] }, [f])).toHaveLength(0)
})

test('attr rule with an empty pattern hits when the attribute exists', () => {
  const f = fp({ div: [{ attr: 'data-foo', pattern: '' }] })
  expect(detect({ url: 'u', dom: ['div'], domAttrs: { div: { 'data-foo': [''] } } }, [f])).toHaveLength(1)
})

test('text rule matches collected text', () => {
  const f = fp({ footer: [{ text: true, pattern: 'Powered by Foo' }] })
  expect(detect({ url: 'u', dom: ['footer'], domText: { footer: ['© 2026', 'Powered by Foo'] } }, [f])).toHaveLength(1)
  expect(detect({ url: 'u', dom: ['footer'] }, [f])).toHaveLength(0)
})

test('presence rule is unchanged', () => {
  const f = fp({ '#app': [{ pattern: '' }] })
  expect(detect({ url: 'u', dom: ['#app'] }, [f])[0]?.evidence).toEqual([{ source: 'dom', pattern: '', match: '', key: '#app' }])
})
