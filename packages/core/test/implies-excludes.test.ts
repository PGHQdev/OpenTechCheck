import { expect, test } from 'bun:test'
import { detect } from '../src/index'
import type { Fingerprint } from '../src/index'

const react: Fingerprint = {
  name: 'React', slug: 'react', category: 'js-framework', website: 'https://react.dev',
  detect: { html: [{ pattern: 'data-reactroot' }] },
}
const nextjs: Fingerprint = {
  name: 'Next.js', slug: 'nextjs', category: 'web-framework', website: 'https://nextjs.org',
  implies: ['react'],
  detect: { html: [{ pattern: '__NEXT_DATA__' }] },
}
const genericCms: Fingerprint = {
  name: 'GenericCMS', slug: 'generic-cms', category: 'cms', website: 'https://x.com',
  detect: { html: [{ pattern: 'cms' }] },
}
const wordpress: Fingerprint = {
  name: 'WordPress', slug: 'wordpress', category: 'cms', website: 'https://wordpress.org',
  excludes: ['generic-cms'], implies: ['generic-cms'],
  detect: { html: [{ pattern: 'wp-content' }] },
}

test('implies adds technology at 0.9 confidence with implied evidence', () => {
  const out = detect({ url: 'u', html: '__NEXT_DATA__' }, [react, nextjs])
  const r = out.find((d) => d.slug === 'react')
  expect(r?.confidence).toBe(90)
  expect(r?.evidence).toEqual([{ source: 'implied', pattern: 'implied-by: nextjs', match: '' }])
})

test('direct detection beats implication', () => {
  const out = detect({ url: 'u', html: '__NEXT_DATA__ data-reactroot' }, [react, nextjs])
  expect(out.find((d) => d.slug === 'react')?.confidence).toBe(100)
})

test('excludes removes a matched technology', () => {
  const out = detect({ url: 'u', html: 'cms wp-content' }, [genericCms, wordpress])
  expect(out.map((d) => d.slug)).toEqual(['wordpress'])
})

test('implies never resurrects an excluded slug', () => {
  const out = detect({ url: 'u', html: 'cms wp-content' }, [genericCms, wordpress])
  expect(out.find((d) => d.slug === 'generic-cms')).toBeUndefined()
})

test('transitive implies multiplies per hop', () => {
  const a: Fingerprint = { name: 'A', slug: 'a', category: 'cms', website: 'https://x.com', implies: ['b'], detect: { html: [{ pattern: 'aaa' }] } }
  const b: Fingerprint = { name: 'B', slug: 'b', category: 'cms', website: 'https://x.com', implies: ['c'], detect: {} }
  const c: Fingerprint = { name: 'C', slug: 'c', category: 'cms', website: 'https://x.com', detect: {} }
  const out = detect({ url: 'u', html: 'aaa' }, [a, b, c])
  expect(out.find((d) => d.slug === 'c')?.confidence).toBe(81)  // round(round(100*.9)*.9)
})
