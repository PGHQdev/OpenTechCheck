import { expect, test } from 'bun:test'
import { detect } from '../src/index'
import type { Fingerprint } from '../src/index'

const fp = (slug: string, d: Fingerprint['detect']): Fingerprint => ({
  name: slug, slug, category: 'cms', website: 'https://x.com', detect: d,
})

test('single low-confidence rule', () => {
  const f = fp('a', { html: [{ pattern: 'aaa', confidence: 40 }] })
  expect(detect({ url: 'u', html: 'aaa' }, [f])[0]?.confidence).toBe(40)
})

test('max rule wins within one source', () => {
  const f = fp('a', { html: [{ pattern: 'aaa', confidence: 40 }, { pattern: 'bbb', confidence: 70 }] })
  expect(detect({ url: 'u', html: 'aaa bbb' }, [f])[0]?.confidence).toBe(70)
})

test('+5 per additional distinct source, capped at 100', () => {
  const f = fp('a', {
    html: [{ pattern: 'aaa', confidence: 90 }],
    scripts: [{ pattern: 'bbb', confidence: 10 }],
    meta: { generator: [{ pattern: 'ccc', confidence: 10 }] },
  })
  const bundle = { url: 'u', html: 'aaa', scripts: ['bbb'], meta: { generator: ['ccc'] } }
  expect(detect(bundle, [f])[0]?.confidence).toBe(100)  // 90 + 5 + 5
})

test('cap at 100', () => {
  const f = fp('a', { html: [{ pattern: 'aaa' }], scripts: [{ pattern: 'bbb' }] })
  expect(detect({ url: 'u', html: 'aaa', scripts: ['bbb'] }, [f])[0]?.confidence).toBe(100)
})

test('output sorted by confidence desc then slug asc', () => {
  const low = fp('zeta', { html: [{ pattern: 'x', confidence: 30 }] })
  const hi = fp('alpha', { html: [{ pattern: 'x', confidence: 90 }] })
  const tie = fp('beta', { html: [{ pattern: 'x', confidence: 90 }] })
  const out = detect({ url: 'u', html: 'x' }, [low, tie, hi])
  expect(out.map((d) => d.slug)).toEqual(['alpha', 'beta', 'zeta'])
})
