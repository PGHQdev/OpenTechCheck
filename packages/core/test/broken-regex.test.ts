import { expect, test } from 'bun:test'
import { detect } from '../src/index'
import type { Fingerprint } from '../src/index'

const broken: Fingerprint = {
  name: 'Broken', slug: 'broken', category: 'cms', website: 'https://x.com',
  detect: { html: [{ pattern: '([' }, { pattern: 'works' }] },
}

test('broken pattern is skipped, other rules still run', () => {
  const warnings: string[] = []
  const out = detect({ url: 'u', html: 'works' }, [broken], { onWarning: (m) => warnings.push(m) })
  expect(out[0]?.slug).toBe('broken')
  expect(out[0]?.evidence).toHaveLength(1)
  expect(warnings).toHaveLength(1)
  expect(warnings[0]).toContain('([')
})

test('no onWarning provided: scan still completes silently', () => {
  expect(detect({ url: 'u', html: 'works' }, [broken])).toHaveLength(1)
})
