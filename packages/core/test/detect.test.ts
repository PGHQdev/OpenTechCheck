import { expect, test } from 'bun:test'
import { detect } from '../src/index'
import type { Fingerprint, SignalBundle } from '../src/index'

const nextjs: Fingerprint = {
  name: 'Next.js', slug: 'nextjs', category: 'web-framework',
  website: 'https://nextjs.org',
  detect: {
    html: [{ pattern: '__NEXT_DATA__' }],
    scripts: [{ pattern: '/_next/static/' }],
  },
}

test('detects via html pattern with evidence', () => {
  const bundle: SignalBundle = { url: 'https://a.com', html: '<script id="__NEXT_DATA__">' }
  const [d] = detect(bundle, [nextjs])
  expect(d?.slug).toBe('nextjs')
  expect(d?.evidence[0]).toEqual({ source: 'html', pattern: '__NEXT_DATA__', match: '__NEXT_DATA__' })
})

test('detects via script URL', () => {
  const bundle: SignalBundle = { url: 'https://a.com', scripts: ['https://a.com/_next/static/x.js'] }
  expect(detect(bundle, [nextjs])[0]?.slug).toBe('nextjs')
})

test('matching is case-insensitive', () => {
  const bundle: SignalBundle = { url: 'https://a.com', html: '__next_data__' }
  expect(detect(bundle, [nextjs])).toHaveLength(1)
})

test('absent fields are skipped, no match no detection', () => {
  expect(detect({ url: 'https://a.com' }, [nextjs])).toHaveLength(0)
})
