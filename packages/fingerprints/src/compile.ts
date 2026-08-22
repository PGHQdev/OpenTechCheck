import { readdirSync, readFileSync, mkdirSync, writeFileSync } from 'node:fs'
import { join, basename } from 'node:path'
import { parse } from 'yaml'
import type { Fingerprint, Rule } from '@opentechcheck/core'
import { validateFingerprint } from './validate'
import { lintPattern } from './lint'

function* yamlFiles(dir: string): Generator<string> {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name)
    if (entry.isDirectory()) yield* yamlFiles(full)
    else if (entry.name.endsWith('.yaml')) yield full
  }
}

function* allRules(fp: Fingerprint): Generator<Rule> {
  const d = fp.detect
  for (const list of [d.html ?? [], d.scripts ?? []]) yield* list
  for (const table of [d.headers, d.meta, d.cookies, d.js, d.dom]) {
    for (const list of Object.values(table ?? {})) yield* list
  }
}

export function compile(srcDir: string): { fingerprints: Fingerprint[]; errors: string[] } {
  const fingerprints: Fingerprint[] = []
  const errors: string[] = []
  for (const file of yamlFiles(srcDir)) {
    let doc: unknown
    try {
      doc = parse(readFileSync(file, 'utf8'))
    } catch (err) {
      errors.push(`${file}: yaml parse error: ${String(err)}`)
      continue
    }
    const docErrors = validateFingerprint(doc)
    if (docErrors.length > 0) {
      errors.push(...docErrors.map((e) => `${file}: ${e}`))
      continue
    }
    const fp = doc as Fingerprint
    if (basename(file, '.yaml') !== fp.slug) {
      errors.push(`${file}: filename must equal slug "${fp.slug}"`)
    }
    for (const rule of allRules(fp)) {
      const lintError = lintPattern(rule.pattern)
      if (lintError) errors.push(`${file}: pattern ${JSON.stringify(rule.pattern)}: ${lintError}`)
    }
    fingerprints.push(fp)
  }
  const slugs = new Set(fingerprints.map((f) => f.slug))
  for (const fp of fingerprints) {
    for (const ref of [...(fp.implies ?? []), ...(fp.excludes ?? [])]) {
      if (!slugs.has(ref)) errors.push(`${fp.slug}: references unknown slug "${ref}"`)
    }
  }
  fingerprints.sort((a, b) => a.slug.localeCompare(b.slug))
  return { fingerprints, errors }
}

if (import.meta.main) {
  const srcDir = join(import.meta.dir, '..', 'src', 'registry')
  const { fingerprints, errors } = compile(srcDir)
  if (errors.length > 0) {
    for (const e of errors) console.error(e)
    process.exit(1)
  }
  const outDir = join(import.meta.dir, '..', 'dist')
  mkdirSync(outDir, { recursive: true })
  writeFileSync(join(outDir, 'fingerprints.json'), JSON.stringify(fingerprints, null, 2))
  console.log(`compiled ${fingerprints.length} fingerprints`)
}
