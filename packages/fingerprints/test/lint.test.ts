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

test('rejects a leading unbounded repeat', () => {
  expect(lintPattern('[a-z-]+\\.i\\.posthog\\.com')).toContain('leading unbounded repeat')
  expect(lintPattern('\\w*foo')).toContain('leading unbounded repeat')
  expect(lintPattern('.+bar')).toContain('leading unbounded repeat')
  expect(lintPattern('[a-z]{2,}baz')).toContain('leading unbounded repeat')
})

test('accepts a bounded, anchored, or later repeat', () => {
  expect(lintPattern('[a-z-]\\.i\\.posthog\\.com')).toBeNull()
  expect(lintPattern('^[\\d.]+$')).toBeNull()
  expect(lintPattern('[a-z]{2,4}baz')).toBeNull()
  expect(lintPattern('ver-[\\d.]+')).toBeNull()
  expect(lintPattern('\\.min\\.js')).toBeNull()
})
