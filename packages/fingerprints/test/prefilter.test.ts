import { expect, test } from 'bun:test'
import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import type { SignalBundle } from '@opentechcheck/core'
import { LiteralSet, requiredLiterals } from '../../core/src/prefilter'
import { pageText } from '../../core/src/text'
import { compile } from '../src/compile'

const FIXTURES = process.env.OTC_FIXTURES ? resolve(process.env.OTC_FIXTURES) : undefined
const { fingerprints } = compile(join(import.meta.dir, '..', 'src', 'registry'))

// The prefilter skips a rule when a clause has none of its literals in the page. That is
// safe only if every match satisfies every clause, so check each match on the real pages.
if (FIXTURES === undefined || !existsSync(FIXTURES)) {
  test.skip('prefilter literals hold on real pages (set OTC_FIXTURES to run it)', () => {})
} else {
  test('prefilter literals hold on real pages', () => {
    const rules = fingerprints.flatMap((fp) => [
      ...(fp.detect.html ?? []).map((rule) => ({ slug: fp.slug, source: 'html' as const, rule })),
      ...(fp.detect.text ?? []).map((rule) => ({ slug: fp.slug, source: 'text' as const, rule })),
    ]).flatMap((r) => {
      const clauses = r.rule.pattern === '' ? null : requiredLiterals(r.rule.pattern)
      return clauses === null ? [] : [{ ...r, clauses }]
    })
    const all = [...new Set(rules.flatMap((r) => r.clauses.flat()))]
    const set = new LiteralSet(all)
    const misses: string[] = []
    let matches = 0
    for (const dir of readdirSync(FIXTURES, { withFileTypes: true }).filter((e) => e.isDirectory())) {
      for (const file of readdirSync(join(FIXTURES, dir.name)).filter((f) => f.endsWith('.bundle.json'))) {
        const bundle = JSON.parse(readFileSync(join(FIXTURES, dir.name, file), 'utf8')) as SignalBundle
        if (bundle.html === undefined) continue
        const page = { html: bundle.html, text: pageText(bundle.html) }
        const present = { html: set.scan(page.html), text: set.scan(page.text) }
        for (const { slug, source, rule, clauses } of rules) {
          if (!new RegExp(rule.pattern, 'i').test(page[source])) continue
          matches++
          if (!clauses.every((c) => c.some((l) => present[source][all.indexOf(l)] === 1))) {
            misses.push(`${slug} ${JSON.stringify(rule.pattern)} on ${dir.name}/${file}`)
          }
        }
      }
    }
    expect(misses).toEqual([])
    expect(matches).toBeGreaterThan(0)
  }, 300_000) // every html rule on every real page: slower than the default 5 s on CI runners and under parallel load
}
