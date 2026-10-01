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

test('accepts within, url, text, and dom attr/text rules', () => {
  const doc = {
    ...valid,
    within: { techs: ['woocommerce'], categories: ['ecommerce'] },
    detect: {
      url: [{ pattern: '\\.wp\\.com' }],
      text: [{ pattern: 'Powered by WordPress' }],
      dom: {
        'meta[name="generator"]': [{ attr: 'content', pattern: 'WordPress ([\\d.]+)', version: 1 }],
        footer: [{ text: true, pattern: 'WordPress' }],
        '#wp': [{ pattern: '' }],
      },
    },
  }
  expect(validateFingerprint(doc)).toEqual([])
})

test('unknown within category rejected', () => {
  expect(validateFingerprint({ ...valid, within: { categories: ['nope'] } })[0]).toContain('nope')
})

test('empty within rejected', () => {
  expect(validateFingerprint({ ...valid, within: {} }).length).toBeGreaterThan(0)
  expect(validateFingerprint({ ...valid, within: { techs: [] } }).length).toBeGreaterThan(0)
})

test('dom rule with both attr and text rejected', () => {
  const doc = { ...valid, detect: { dom: { div: [{ attr: 'id', text: true, pattern: 'x' }] } } }
  expect(validateFingerprint(doc).length).toBeGreaterThan(0)
})

test('attr outside dom rejected', () => {
  const doc = { ...valid, detect: { html: [{ attr: 'id', pattern: 'x' }] } }
  expect(validateFingerprint(doc).length).toBeGreaterThan(0)
})
