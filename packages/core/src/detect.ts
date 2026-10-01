import { runRule, type RuleHit } from './match'
import { LiteralSet, requiredLiterals } from './prefilter'
import { pageText } from './text'
import type { Detection, DetectOptions, Fingerprint, Rule, SignalBundle, Within } from './types'

// Per-call page state that every fingerprint shares.
export interface Page {
  text: () => string | undefined
  mayMatch: (rule: Rule, source: 'html' | 'text') => boolean
}

export function collectHits(fp: Fingerprint, bundle: SignalBundle, options: DetectOptions, page: Page): RuleHit[] {
  const hits: RuleHit[] = []
  const d = fp.detect
  if (bundle.html !== undefined) {
    for (const rule of d.html ?? []) {
      if (!page.mayMatch(rule, 'html')) continue
      const h = runRule(rule, 'html', bundle.html, undefined, options.onWarning)
      if (h) hits.push(h)
    }
  }
  for (const rule of d.url ?? []) {
    const h = runRule(rule, 'url', bundle.url, undefined, options.onWarning)
    if (h) hits.push(h)
  }
  if (d.text) {
    const value = page.text()
    if (value !== undefined) {
      for (const rule of d.text) {
        if (!page.mayMatch(rule, 'text')) continue
        const h = runRule(rule, 'text', value, undefined, options.onWarning)
        if (h) hits.push(h)
      }
    }
  }
  for (const rule of d.scripts ?? []) {
    for (const src of bundle.scripts ?? []) {
      const h = runRule(rule, 'scripts', src, undefined, options.onWarning)
      if (h) { hits.push(h); break }
    }
  }
  const keyedText: Array<['headers' | 'meta', Record<string, string[]> | undefined]> = [
    ['headers', bundle.headers],
    ['meta', bundle.meta],
  ]
  for (const [source, table] of keyedText) {
    const spec = d[source]
    if (!spec || !table) continue
    for (const [key, rules] of Object.entries(spec)) {
      const values = table[key]
      if (values === undefined) continue
      for (const rule of rules) {
        for (const value of values.length > 0 ? values : ['']) {
          const h = runRule(rule, source, value, key, options.onWarning)
          if (h) { hits.push(h); break }
        }
      }
    }
  }
  for (const [key, rules] of Object.entries(d.cookies ?? {})) {
    const value = bundle.cookies?.[key]
    if (value === undefined) continue
    for (const rule of rules) {
      const h = runRule(rule, 'cookies', value, key, options.onWarning)
      if (h) hits.push(h)
    }
  }
  for (const [key, rules] of Object.entries(d.js ?? {})) {
    if (!bundle.js || !(key in bundle.js)) continue
    const value = String(bundle.js[key] ?? '')
    for (const rule of rules) {
      const h = runRule(rule, 'js', value, key, options.onWarning)
      if (h) hits.push(h)
    }
  }
  for (const [key, rules] of Object.entries(d.dom ?? {})) {
    if (!bundle.dom?.includes(key)) continue
    for (const rule of rules) {
      const values = rule.attr !== undefined ? bundle.domAttrs?.[key]?.[rule.attr]
        : rule.text ? bundle.domText?.[key]
        : ['']
      for (const value of values ?? []) {
        const h = runRule(rule, 'dom', value, key, options.onWarning)
        if (h) { hits.push(h); break }
      }
    }
  }
  return hits
}

export function toDetection(fp: Fingerprint, hits: RuleHit[]): Detection {
  const maxConf = Math.max(...hits.map((h) => h.rule.confidence ?? 100))
  const sources = new Set(hits.map((h) => h.evidence.source))
  const confidence = Math.min(100, maxConf + 5 * (sources.size - 1))

  let version: string | null = null
  let versionConf = -1
  for (const h of hits) {
    if (h.rule.version === undefined) continue
    const captured = h.captures[h.rule.version]
    if (!captured) continue
    const conf = h.rule.confidence ?? 100
    if (conf > versionConf) { version = captured; versionConf = conf }
  }

  return {
    slug: fp.slug,
    name: fp.name,
    category: fp.category,
    confidence,
    version,
    evidence: hits.map((h) => h.evidence),
  }
}

interface Prefilter { literals: LiteralSet; clauses: WeakMap<Rule, number[][]> }
const prefilters = new WeakMap<Fingerprint[], Prefilter>()

// Built once per registry array: callers pass the same array on every call.
// html and text rules with no required literal are not in clauses and always run.
function prefilterOf(fingerprints: Fingerprint[]): Prefilter {
  let prefilter = prefilters.get(fingerprints)
  if (prefilter) return prefilter
  const idOf = new Map<string, number>()
  const clauses = new WeakMap<Rule, number[][]>()
  for (const fp of fingerprints) {
    for (const rule of [...(fp.detect.html ?? []), ...(fp.detect.text ?? [])]) {
      const required = rule.pattern === '' ? null : requiredLiterals(rule.pattern)
      if (required === null) continue
      clauses.set(rule, required.map((clause) => clause.map((literal) => {
        if (!idOf.has(literal)) idOf.set(literal, idOf.size)
        return idOf.get(literal)!
      })))
    }
  }
  prefilter = { literals: new LiteralSet([...idOf.keys()]), clauses }
  prefilters.set(fingerprints, prefilter)
  return prefilter
}

interface Context { techs: Set<string>; categories: Set<string> }

// Detected techs plus everything they imply (excludes do not apply yet).
function contextOf(found: Map<string, Detection>, bySlug: Map<string, Fingerprint>): Context {
  const techs = new Set(found.keys())
  const queue = [...techs]
  while (queue.length > 0) {
    for (const slug of bySlug.get(queue.pop()!)?.implies ?? []) {
      if (techs.has(slug) || !bySlug.has(slug)) continue
      techs.add(slug)
      queue.push(slug)
    }
  }
  const categories = new Set([...techs].map((slug) => bySlug.get(slug)!.category))
  return { techs, categories }
}

const opens = (within: Within, context: Context) =>
  (within.techs ?? []).some((t) => context.techs.has(t)) ||
  (within.categories ?? []).some((c) => context.categories.has(c))

export function detect(
  bundle: SignalBundle, fingerprints: Fingerprint[], options: DetectOptions = {},
): Detection[] {
  const bySlug = new Map(fingerprints.map((f) => [f.slug, f]))
  const found = new Map<string, Detection>()
  const prefilter = prefilterOf(fingerprints)
  // Derived and scanned on first use, at most once per call.
  let derived: string | undefined
  let inHtml: Uint8Array | undefined
  let inText: Uint8Array | undefined
  const page: Page = {
    text: () => (bundle.html === undefined ? undefined : (derived ??= pageText(bundle.html))),
    mayMatch: (rule, source) => {
      const required = prefilter.clauses.get(rule)
      if (required === undefined) return true
      const present = source === 'html'
        ? (inHtml ??= prefilter.literals.scan(bundle.html ?? ''))
        : (inText ??= prefilter.literals.scan(page.text() ?? ''))
      return required.every((clause) => clause.some((id) => present[id] === 1))
    },
  }
  const gated: Fingerprint[] = []
  for (const fp of fingerprints) {
    if (fp.within) { gated.push(fp); continue }
    const hits = collectHits(fp, bundle, options, page)
    if (hits.length > 0) found.set(fp.slug, toDetection(fp, hits))
  }
  // A gated fingerprint runs once, when its gate first opens; new hits can open more gates.
  let waiting = gated
  while (waiting.length > 0) {
    const context = contextOf(found, bySlug)
    const closed = waiting.filter((fp) => !opens(fp.within!, context))
    if (closed.length === waiting.length) break
    for (const fp of waiting) {
      if (closed.includes(fp)) continue
      const hits = collectHits(fp, bundle, options, page)
      if (hits.length > 0) found.set(fp.slug, toDetection(fp, hits))
    }
    waiting = closed
  }
  // excludes: fingerprint list order; mutual excludes resolve to the earlier one
  const excluded = new Set<string>()
  for (const fp of fingerprints) {
    if (!found.has(fp.slug) || excluded.has(fp.slug)) continue
    for (const ex of fp.excludes ?? []) { excluded.add(ex); found.delete(ex) }
  }
  // implies: BFS from every direct detection
  const queue = [...found.values()]
  while (queue.length > 0) {
    const parent = queue.shift()!
    const fp = bySlug.get(parent.slug)
    for (const slug of fp?.implies ?? []) {
      if (found.has(slug) || excluded.has(slug)) continue
      const target = bySlug.get(slug)
      if (!target) continue                      // compiler prevents this; be lenient at runtime
      const child: Detection = {
        slug: target.slug, name: target.name, category: target.category,
        confidence: Math.round(parent.confidence * 0.9),
        version: null,
        evidence: [{ source: 'implied', pattern: `implied-by: ${parent.slug}`, match: '' }],
      }
      found.set(slug, child)
      queue.push(child)
    }
  }
  const out = [...found.values()]
  out.sort((a, b) => b.confidence - a.confidence || a.slug.localeCompare(b.slug))
  return out
}
