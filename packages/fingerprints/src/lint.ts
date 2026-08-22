// Quantified group that itself contains a quantifier: classic ReDoS shape.
const NESTED_QUANTIFIER = /\((?:[^()\\]|\\.)*(?<!\\)[+*](?:[^()\\]|\\.)*\)[+*]/

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
  return null
}
