import { runRule, type RuleHit } from './match'
import type { Detection, DetectOptions, Fingerprint, SignalBundle } from './types'

export function collectHits(fp: Fingerprint, bundle: SignalBundle, options: DetectOptions): RuleHit[] {
  const hits: RuleHit[] = []
  const d = fp.detect
  if (bundle.html !== undefined) {
    for (const rule of d.html ?? []) {
      const h = runRule(rule, 'html', bundle.html)
      if (h) hits.push(h)
    }
  }
  for (const rule of d.scripts ?? []) {
    for (const src of bundle.scripts ?? []) {
      const h = runRule(rule, 'scripts', src)
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
          const h = runRule(rule, source, value, key)
          if (h) { hits.push(h); break }
        }
      }
    }
  }
  for (const [key, rules] of Object.entries(d.cookies ?? {})) {
    const value = bundle.cookies?.[key]
    if (value === undefined) continue
    for (const rule of rules) {
      const h = runRule(rule, 'cookies', value, key)
      if (h) hits.push(h)
    }
  }
  for (const [key, rules] of Object.entries(d.js ?? {})) {
    if (!bundle.js || !(key in bundle.js)) continue
    const value = String(bundle.js[key] ?? '')
    for (const rule of rules) {
      const h = runRule(rule, 'js', value, key)
      if (h) hits.push(h)
    }
  }
  for (const [key, rules] of Object.entries(d.dom ?? {})) {
    if (!bundle.dom?.includes(key)) continue
    for (const rule of rules) {
      const h = runRule(rule, 'dom', '', key)
      if (h) hits.push(h)
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

export function detect(
  bundle: SignalBundle, fingerprints: Fingerprint[], options: DetectOptions = {},
): Detection[] {
  const bySlug = new Map(fingerprints.map((f) => [f.slug, f]))
  const found = new Map<string, Detection>()
  for (const fp of fingerprints) {
    const hits = collectHits(fp, bundle, options)
    if (hits.length > 0) found.set(fp.slug, toDetection(fp, hits))
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
