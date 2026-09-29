import { expect, test } from 'bun:test'
import { jsPaths, domSelectors } from '../build/generate-lists'
import type { Fingerprint } from '@opentechcheck/core'
import registry from '@opentechcheck/fingerprints'

const fps: Fingerprint[] = [
  { name: 'A', slug: 'a', category: 'other', website: 'https://a.dev',
    detect: { js: { 'React.version': [{ pattern: '' }], jQuery: [{ pattern: '' }] } } },
  { name: 'B', slug: 'b', category: 'other', website: 'https://b.dev',
    detect: { js: { jQuery: [{ pattern: '' }] }, dom: { '#__next': [{ pattern: '' }] } } },
]

test('collects sorted unique js paths', () => {
  expect(jsPaths(fps)).toEqual(['React.version', 'jQuery'].sort())
})

test('collects sorted unique dom selectors', () => {
  expect(domSelectors(fps)).toEqual(['#__next'])
})

test('runs over the real registry without throwing', () => {
  expect(Array.isArray(jsPaths(registry as Fingerprint[]))).toBe(true)
  expect(Array.isArray(domSelectors(registry as Fingerprint[]))).toBe(true)
})
