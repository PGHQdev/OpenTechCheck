import type { Evidence, Rule, Source } from './types'

export interface RuleHit {
  rule: Rule
  evidence: Evidence
  captures: string[]       // regex capture groups (index 1 = captures[1])
}

const MAX_MATCH_LEN = 100

export function runRule(
  rule: Rule, source: Source, text: string, key?: string,
  onWarning?: (message: string) => void,
): RuleHit | null {
  if (rule.pattern === '') {
    return { rule, captures: [], evidence: { source, pattern: '', match: '', ...(key ? { key } : {}) } }
  }
  let m: RegExpExecArray | null
  try {
    m = new RegExp(rule.pattern, 'i').exec(text)
  } catch (err) {
    onWarning?.(`invalid pattern ${JSON.stringify(rule.pattern)} (${source}): ${String(err)}`)
    return null
  }
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
