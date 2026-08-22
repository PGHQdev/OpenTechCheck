import { expect, test, describe } from 'bun:test'
import { readdirSync, readFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import { detect, type SignalBundle } from '@opentechcheck/core'
import { compile } from '../src/compile'

const REGISTRY = join(import.meta.dir, '..', 'src', 'registry')
const FIXTURES = join(import.meta.dir, '..', '..', '..', 'fixtures')

const { fingerprints, errors } = compile(REGISTRY)

test('registry compiles clean', () => {
  expect(errors).toEqual([])
})

const slugDirs = existsSync(FIXTURES)
  ? readdirSync(FIXTURES, { withFileTypes: true }).filter((e) => e.isDirectory()).map((e) => e.name)
  : []

test('every fingerprint has at least one fixture', () => {
  const missing = fingerprints.map((f) => f.slug).filter((s) => !slugDirs.includes(s))
  expect(missing).toEqual([])
})

for (const slug of slugDirs) {
  describe(`fixtures/${slug}`, () => {
    const dir = join(FIXTURES, slug)
    const bundles = readdirSync(dir).filter((f) => f.endsWith('.bundle.json'))
    test('has at least one bundle', () => expect(bundles.length).toBeGreaterThan(0))
    for (const file of bundles) {
      test(file, () => {
        const bundle = JSON.parse(readFileSync(join(dir, file), 'utf8')) as SignalBundle
        const expectedPath = join(dir, file.replace('.bundle.json', '.expected.json'))
        const { detects } = JSON.parse(readFileSync(expectedPath, 'utf8')) as { detects: string[] }
        const got = detect(bundle, fingerprints).map((d) => d.slug).sort()
        expect(got).toEqual([...detects].sort())
      })
    }
  })
}
