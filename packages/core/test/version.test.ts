import { expect, test } from 'bun:test'
import { detect } from '../src/index'
import type { Fingerprint } from '../src/index'

const fp = (d: Fingerprint['detect']): Fingerprint => ({
  name: 'X', slug: 'x', category: 'cms', website: 'https://x.com', detect: d,
})

test('captures version from group index', () => {
  const f = fp({ meta: { generator: [{ pattern: 'WordPress\\s([\\d.]+)', version: 1 }] } })
  const out = detect({ url: 'u', meta: { generator: ['WordPress 6.5.2'] } }, [f])
  expect(out[0]?.version).toBe('6.5.2')
})

test('no version rule -> null', () => {
  const f = fp({ html: [{ pattern: 'x' }] })
  expect(detect({ url: 'u', html: 'x' }, [f])[0]?.version).toBeNull()
})

test('empty capture does not win over non-empty', () => {
  const f = fp({
    html: [{ pattern: 'v(?:ersion=([\\d.]+))?', version: 1, confidence: 100 }],
    scripts: [{ pattern: 'lib-([\\d.]+)\\.js', version: 1, confidence: 50 }],
  })
  const out = detect({ url: 'u', html: 'v', scripts: ['lib-2.1.0.js'] }, [f])
  expect(out[0]?.version).toBe('2.1.0')
})

test('higher-confidence rule wins version conflicts', () => {
  const f = fp({
    scripts: [{ pattern: 'lib-([\\d.]+)\\.js', version: 1, confidence: 50 }],
    headers: { 'x-ver': [{ pattern: '([\\d.]+)', version: 1, confidence: 90 }] },
  })
  const out = detect({ url: 'u', scripts: ['lib-1.0.0.js'], headers: { 'x-ver': ['2.0.0'] } }, [f])
  expect(out[0]?.version).toBe('2.0.0')
})

test('equal confidence: first hit in source order wins', () => {
  const f = fp({
    html: [{ pattern: 'v=([\\d.]+)', version: 1 }],
    scripts: [{ pattern: 'lib-([\\d.]+)\\.js', version: 1 }],
  })
  const out = detect({ url: 'u', html: 'v=1.1', scripts: ['lib-9.9.js'] }, [f])
  expect(out[0]?.version).toBe('1.1')
})
