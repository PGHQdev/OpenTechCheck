import { expect, test } from 'bun:test'
import { validateFingerprint } from '../src/validate'

const valid = {
  name: 'WordPress', slug: 'wordpress', category: 'cms', website: 'https://wordpress.org',
  detect: { html: [{ pattern: 'wp-content' }] },
}

test('valid fingerprint -> no errors', () => {
  expect(validateFingerprint(valid)).toEqual([])
})

test('unknown category rejected', () => {
  expect(validateFingerprint({ ...valid, category: 'nope' })[0]).toContain('category')
})

test('uppercase header key rejected', () => {
  const doc = { ...valid, detect: { headers: { 'X-Powered-By': [{ pattern: 'x' }] } } }
  expect(validateFingerprint(doc)[0]).toContain('lowercase')
})

test('missing pattern rejected', () => {
  const doc = { ...valid, detect: { html: [{ confidence: 50 }] } }
  expect(validateFingerprint(doc).length).toBeGreaterThan(0)
})
