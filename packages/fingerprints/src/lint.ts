// Quantified group that itself contains a quantifier: classic ReDoS shape.
const NESTED_QUANTIFIER = /\((?:[^()\\]|\\.)*(?<!\\)[+*](?:[^()\\]|\\.)*\)[+*]/
// A class, escape class, or dot repeated without bound at the start: the engine retries
// it from every position of the page, so the cost grows with each run of matching text.
const LEADING_REPEAT = /^(?:\[(?:[^\]\\]|\\.)*\]|\\[wdsWDS]|\.)(?:[+*]|\{\d+,\})/

export function lintPattern(pattern: string): string | null {
  if (pattern === '') return null
  try {
    new RegExp(pattern, 'i')
  } catch (err) {
    return `invalid regex: ${String(err)}`
  }
  if (NESTED_QUANTIFIER.test(pattern)) {
    return 'nested quantifier (ReDoS risk): rewrite the pattern without a quantified group under a quantifier'
  }
  if (LEADING_REPEAT.test(pattern)) {
    return 'leading unbounded repeat (slow on large pages): start with a literal, anchor with ^, or match one character'
  }
  return null
}
