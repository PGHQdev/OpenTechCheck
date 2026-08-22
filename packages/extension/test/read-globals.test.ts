import { expect, test } from 'bun:test'
import { readGlobals } from '../src/main-world/read-globals'

test('resolves dotted paths and stringifies with cap', () => {
  const root = { React: { version: '18.3.1' }, jQuery: () => {}, big: 'x'.repeat(999) }
  const out = readGlobals(root, ['React.version', 'jQuery', 'big', 'missing.deep'], 200)
  expect(out['React.version']).toBe('18.3.1')
  expect(typeof out['jQuery']).toBe('string')
  expect((out['big'] as string).length).toBe(200)
  expect('missing.deep' in out).toBe(false)
})

test('a throwing getter is skipped', () => {
  const root: any = {}
  Object.defineProperty(root, 'trap', { get() { throw new Error('nope') } })
  expect(readGlobals(root, ['trap'], 200)).toEqual({})
})

test('$probe paths are never resolved against window', () => {
  const root: any = { $probe: { react: 'forged' }, React: { version: '18.3.1' } }
  const out = readGlobals(root, ['$probe.react', 'React.version'], 200)
  expect('$probe.react' in out).toBe(false)
  expect(out['React.version']).toBe('18.3.1')
})
