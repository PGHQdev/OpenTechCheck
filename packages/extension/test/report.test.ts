import { expect, test } from 'bun:test'
import { reportUrl } from '../src/popup/report'

test('report prefill stays in the fragment and strips credentials, query and page fragment', () => {
  const url = new URL(reportUrl('https://user:secret@example.com/page?token=secret#private', 'coverage-gap', '0.1.0'))
  expect(url.origin + url.pathname + url.search).toBe('https://opentechcheck.com/report')
  const data = new URLSearchParams(url.hash.slice(1))
  expect(data.get('website')).toBe('https://example.com/page')
  expect(data.get('type')).toBe('coverage-gap')
  expect(data.get('version')).toBe('0.1.0')
  expect(url.href).not.toContain('secret')
})
