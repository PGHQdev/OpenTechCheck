import { expect, test } from 'bun:test'
import { toHeaderTable, toCookieRecord, toBundle } from '../src/background/assemble'

test('header names lowercase, multi-value preserved', () => {
  const t = toHeaderTable([
    { name: 'Set-Cookie', value: 'a=1' },
    { name: 'set-cookie', value: 'b=2' },
    { name: 'X-Empty' },
  ])
  expect(t['set-cookie']).toEqual(['a=1', 'b=2'])
  expect(t['x-empty']).toEqual([''])
})

test('cookie record: first wins', () => {
  expect(toCookieRecord([{ name: 's', value: '1' }, { name: 's', value: '2' }])).toEqual({ s: '1' })
})

test('toBundle maps every field', () => {
  const b = toBundle(
    { url: 'https://x.dev/', html: '<html>', meta: { generator: ['WP'] }, scripts: ['/a.js'], dom: ['#n'], js: { jQuery: 'f' } },
    { server: ['nginx'] },
    { sid: 'v' },
  )
  expect(b).toEqual({
    url: 'https://x.dev/', html: '<html>', meta: { generator: ['WP'] }, scripts: ['/a.js'],
    dom: ['#n'], js: { jQuery: 'f' }, headers: { server: ['nginx'] }, cookies: { sid: 'v' },
  })
})

test('undefined headers stay undefined so header rules skip', () => {
  const b = toBundle({ url: 'u', html: '', meta: {}, scripts: [], dom: [], js: {} }, undefined, {})
  expect(b.headers).toBeUndefined()
})
