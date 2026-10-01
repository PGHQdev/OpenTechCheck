import { expect, test } from 'bun:test'
import { detect } from '../src/index'
import { LiteralSet, requiredLiterals } from '../src/prefilter'
import type { Fingerprint } from '../src/index'

test.each([
  ['__NEXT_DATA__', [['__next_data__']]],
  ['self\\.__next_f', [['self.__next_f']]],
  ['id="__next"', [['id="__next"']]],
  ['wp-(?:content|includes)', [['wp-'], ['content', 'includes']]],
  ['Next\\.js(?:\\s([\\d.]+))?', [['next.js']]],
  ['jquery[.-]?([\\d.]+)?(?:\\.min)?\\.js', [['jquery'], ['.js']]],
  ['abcd|efgh', [['abcd', 'efgh']]],
  ['ab+cde', [['cde']]],
  ['xy?zab', [['zab']]],
  ['abcd{0,2}efg', [['abc'], ['efg']]],
  ['abc{2}de', [['abc']]],
  ['\\x41bcd\\cJxyz', [['bcd'], ['xyz']]],
  ['data-[a-z]+-foo', [['data-'], ['-foo']]],
  ['[|]abc|defg', [['abc', 'defg']]],
  ['(?!nope)real', [['real']]],
  ['(?<!nope)real', [['real']]],
  ['(?=look)ahead', [['ahead'], ['look']]],
  ['^(?-i:GitHub\\.com)$', [['github.com']]],
  ['\\.(?:web\\.app|firebaseapp\\.com)', [['web.app', 'firebaseapp.com']]],
  ['class="[^"]*\\bsvelte-[a-z0-9]{4,12}', [['class="'], ['svelte-']]],
  ['(foo|bar)+baz', [['baz'], ['foo', 'bar']]],
  ['(?<v>abc)', [['abc']]],
  ['café-menu', [['caf'], ['-menu']]],
] as const)('requiredLiterals(%p)', (pattern, expected) => {
  expect(requiredLiterals(pattern)).toEqual(expected.map((c) => [...c]))
})

test.each([
  'a|bcd', '\\d+\\.\\d+', '(foo|ba)', '(foo)?ba', '(?:abc)*', '(?!abc)de',
  '\\u0041bc', '\\u{41}bc', '\\k<n>ab', '\\12ab', '',
])('no literal: %p', (pattern) => {
  expect(requiredLiterals(pattern)).toBeNull()
})

test('LiteralSet finds overlapping literals in either case', () => {
  const set = new LiteralSet(['he', 'she', 'hers', 'his'])
  expect([...set.scan('uSHErs')]).toEqual([1, 1, 1, 0])
  expect([...set.scan('')]).toEqual([0, 0, 0, 0])
})

test('a non-ASCII character breaks a literal', () => {
  const set = new LiteralSet(['abc'])
  expect([...set.scan('abÇ abİc')]).toEqual([0])
  expect([...set.scan('éabc')]).toEqual([1])
})

const fp = (slug: string, d: Fingerprint['detect']): Fingerprint => ({
  name: slug, slug, category: 'cms', website: 'https://x.com', detect: d,
})

test('detect results with the prefilter', () => {
  const fps = [
    fp('alt', { html: [{ pattern: 'wp-(?:content|includes)/v([\\d.]+)', version: 1 }] }),
    fp('either', { html: [{ pattern: 'foo-one|bar-two' }] }),
    fp('modifier', { html: [{ pattern: '(?-i:Exact)' }] }),
    fp('absent', { html: [{ pattern: 'never-here' }] }),
    fp('text', { text: [{ pattern: 'Powered by Foo' }] }),
  ]
  const html = '<p>WP-CONTENT/v6.5</p><i>bar-two</i>Exact <b>Powered</b> by Foo'
  const out = detect({ url: 'u', html }, fps)
  expect(out.map((d) => d.slug).sort()).toEqual(['alt', 'either', 'modifier', 'text'])
  expect(out.find((d) => d.slug === 'alt')?.version).toBe('6.5')
})
