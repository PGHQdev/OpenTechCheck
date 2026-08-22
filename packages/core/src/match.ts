import type { Evidence, Rule, Source } from './types'

export interface RuleHit {
  rule: Rule
  evidence: Evidence
  captures: string[]       // regex capture groups (index 1 = captures[1])
}

const MAX_MATCH_LEN = 100

export function runRule(
  rule: Rule, source: Source, text: string, key?: string,
): RuleHit | null {
  if (rule.pattern === '') {
    return { rule, captures: [], evidence: { source, pattern: '', match: '', ...(key ? { key } : {}) } }
  }
  const re = new RegExp(rule.pattern, 'i')
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
