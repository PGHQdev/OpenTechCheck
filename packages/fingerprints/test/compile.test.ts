import { expect, test } from 'bun:test'
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { compile } from '../src/compile'

function tempRegistry(files: Record<string, string>): string {
  const dir = mkdtempSync(join(tmpdir(), 'otc-'))
  for (const [rel, content] of Object.entries(files)) {
    const full = join(dir, rel)
    mkdirSync(join(full, '..'), { recursive: true })
    writeFileSync(full, content)
  }
  return dir
}

const WP = `name: WordPress
slug: wordpress
category: cms
website: https://wordpress.org
detect:
  html:
    - pattern: wp-content
`

test('compiles valid registry', () => {
  const dir = tempRegistry({ 'cms/wordpress.yaml': WP })
  const { fingerprints, errors } = compile(dir)
  expect(errors).toEqual([])
  expect(fingerprints[0]?.slug).toBe('wordpress')
})

test('slug must match filename', () => {
  const dir = tempRegistry({ 'cms/wrong.yaml': WP })
  expect(compile(dir).errors[0]).toContain('filename')
})

test('implies must reference known slug', () => {
  const dir = tempRegistry({ 'cms/wordpress.yaml': WP.replace('detect:', 'implies: [ghost-slug]\ndetect:') })
  expect(compile(dir).errors[0]).toContain('ghost-slug')
})

test('lint errors are reported with file path', () => {
  const dir = tempRegistry({ 'cms/wordpress.yaml': WP.replace('wp-content', "'(a+)+b'") })
  expect(compile(dir).errors[0]).toContain('wordpress.yaml')
})
