import { expect, test } from 'bun:test'
import { mergeManifest } from '../build/manifest'
import base from '../manifest/base.json'
import chrome from '../manifest/chrome.json'
import firefox from '../manifest/firefox.json'

test('overlay scalar wins, base keys survive', () => {
  const out = mergeManifest({ a: 1, nest: { x: 1, y: 2 } }, { nest: { y: 3 } }) as any
  expect(out.a).toBe(1)
  expect(out.nest).toEqual({ x: 1, y: 3 })
})

test('arrays replace, never concat', () => {
  const out = mergeManifest({ list: [1, 2] }, { list: [3] }) as any
  expect(out.list).toEqual([3])
})

test('chrome manifest gets service worker, firefox gets event page', () => {
  const c = mergeManifest(base, chrome) as any
  const f = mergeManifest(base, firefox) as any
  expect(c.background.service_worker).toBe('background.js')
  expect(f.background.scripts).toEqual(['background.js'])
  expect(c.permissions).toEqual(['webRequest', 'cookies', 'storage', 'webNavigation'])
})
