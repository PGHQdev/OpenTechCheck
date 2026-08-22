import { expect, test } from 'bun:test'
import { grade, groupByCategory, stackSummary, exportPayload, websiteOf, CATEGORY_ORDER } from '../src/popup/format'
import type { Detection } from '@opentechcheck/core'

const d = (slug: string, category: string, confidence: number, version: string | null = null): Detection =>
  ({ slug, name: slug.toUpperCase(), category, confidence, version, evidence: [] })

test('grade boundaries', () => {
  expect(grade(90)).toBe('A'); expect(grade(89)).toBe('B')
  expect(grade(75)).toBe('B'); expect(grade(74)).toBe('C')
  expect(grade(60)).toBe('C'); expect(grade(59)).toBe('D')
})

test('groups follow CATEGORY_ORDER with confidence-desc items', () => {
  const groups = groupByCategory([d('nginx', 'server', 100), d('react', 'js-framework', 100), d('vue', 'js-framework', 80)])
  expect(groups.map((g) => g.category)).toEqual(['js-framework', 'server'])
  expect(groups[0]!.items.map((i) => i.slug)).toEqual(['react', 'vue'])
  expect(CATEGORY_ORDER[0]).toBe('js-framework')
})

test('unknown category sorts last', () => {
  const groups = groupByCategory([d('x', 'zzz-new', 100), d('nginx', 'server', 100)])
  expect(groups.map((g) => g.category)).toEqual(['server', 'zzz-new'])
})

test('stack summary includes versions only when present', () => {
  const s = stackSummary([d('react', 'js-framework', 100, '18.3.1'), d('nginx', 'server', 100)])
  expect(s).toBe('REACT 18.3.1\nNGINX')
})

test('export payload carries grades, never percentages in keys', () => {
  const out = JSON.parse(exportPayload({ url: 'https://x.dev/', detections: [d('react', 'js-framework', 82)] }))
  expect(out.detections[0].grade).toBe('B')
  expect(out.detections[0].confidence).toBe(82)
  expect(out.url).toBe('https://x.dev/')
})

test('websiteOf resolves from the fingerprint registry', () => {
  expect(websiteOf('react')).toContain('react')
})
