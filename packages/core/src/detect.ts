import { runRule, type RuleHit } from './match'
import type { Detection, DetectOptions, Fingerprint, SignalBundle } from './types'

export function collectHits(fp: Fingerprint, bundle: SignalBundle, options: DetectOptions): RuleHit[] {
  const hits: RuleHit[] = []
  const d = fp.detect
  for (const rule of d.html ?? []) {
    if (bundle.html === undefined) break
    const h = runRule(rule, 'html', bundle.html)
    if (h) hits.push(h)
  }
  for (const rule of d.scripts ?? []) {
    for (const src of bundle.scripts ?? []) {
      const h = runRule(rule, 'scripts', src)
      if (h) { hits.push(h); break }
    }
  }
  return hits
}

export function toDetection(fp: Fingerprint, hits: RuleHit[]): Detection {
  return {
    slug: fp.slug,
    name: fp.name,
    category: fp.category,
    confidence: 100,                    // real math in Task 4
    version: null,                      // real resolution in Task 5
    evidence: hits.map((h) => h.evidence),
  }
}

export function detect(
  bundle: SignalBundle, fingerprints: Fingerprint[], options: DetectOptions = {},
): Detection[] {
  const out: Detection[] = []
  for (const fp of fingerprints) {
    const hits = collectHits(fp, bundle, options)
    if (hits.length > 0) out.push(toDetection(fp, hits))
  }
  return out
}
