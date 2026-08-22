import { expect, test } from 'bun:test'
import { lintPattern } from '../src/lint'

test('accepts ordinary patterns', () => {
  expect(lintPattern('WordPress\\s([\\d.]+)')).toBeNull()
  expect(lintPattern('cdn\\.shopify\\.com')).toBeNull()
  expect(lintPattern('')).toBeNull()
})

test('rejects invalid regex', () => {
  expect(lintPattern('([')).toContain('invalid')
})

test('rejects nested quantifiers', () => {
  expect(lintPattern('(a+)+b')).toContain('nested quantifier')
  expect(lintPattern('(?:\\w*)*x')).toContain('nested quantifier')
})
