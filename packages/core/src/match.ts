import type { Evidence, Rule, Source } from './types'

export interface RuleHit {
  rule: Rule
  evidence: Evidence
  captures: string[]       // regex capture groups (index 1 = captures[1])
}

const MAX_MATCH_LEN = 100

// Registries are built once, so rule objects are stable. null marks a pattern
// that did not compile; it warned on its first use.
const compiled = new WeakMap<Rule, RegExp | null>()

function regexOf(rule: Rule, source: Source, onWarning?: (message: string) => void): RegExp | null {
  let re = compiled.get(rule)
  if (re !== undefined) return re
  try {
    re = new RegExp(rule.pattern, 'i')
  } catch (err) {
    onWarning?.(`invalid pattern ${JSON.stringify(rule.pattern)} (${source}): ${String(err)}`)
    re = null
  }
  compiled.set(rule, re)
  return re
}

export function runRule(
  rule: Rule, source: Source, text: string, key?: string,
  onWarning?: (message: string) => void,
): RuleHit | null {
  if (rule.pattern === '') {
    return { rule, captures: [], evidence: { source, pattern: '', match: '', ...(key ? { key } : {}) } }
  }
  const re = regexOf(rule, source, onWarning)
  if (re === null) return null
  const m = re.exec(text)
  if (!m) return null
  return {
    rule,
    captures: Array.from(m, (g) => g ?? ''),
    evidence: {
      source,
      pattern: rule.pattern,
      match: (m[0] ?? '').slice(0, MAX_MATCH_LEN),
      ...(key ? { key } : {}),
    },
  }
}
