// A rule's regex can match only if the page contains its required literals.
// One scan of the page finds every literal, so most regexes never run.

const QUANTIFIER = /[?*+{]/
// Escaped characters that stand for themselves.
const ESCAPED_LITERAL = /[\\^$.|?*+()[\]{}/\-=!:#&'"<>@%,;~` ]/

// End index (exclusive) of the group or class that starts at i.
function skip(src: string, i: number): number {
  if (src[i] === '[') {
    let j = i + 1
    while (j < src.length && src[j] !== ']') j += src[j] === '\\' ? 2 : 1
    return j + 1
  }
  let depth = 0
  for (let j = i; j < src.length; j++) {
    const c = src[j]
    if (c === '\\') j++
    else if (c === '[') j = skip(src, j) - 1
    else if (c === '(') depth++
    else if (c === ')' && --depth === 0) return j + 1
  }
  return src.length
}

// End of an escape's argument (\u plus 4 hex digits, \x41, \cJ, \k<name>, \p{L}, \12), so its
// digits and letters are not read as literal text.
function escapeEnd(src: string, i: number, e: string | undefined): number {
  const to = (close: string) => (src.indexOf(close, i) < 0 ? src.length : src.indexOf(close, i) + 1)
  if (e === 'u') return src[i] === '{' ? to('}') : i + 4
  if (e === 'x') return i + 2
  if (e === 'c') return i + 1
  if (e === 'k' && src[i] === '<') return to('>')
  if ((e === 'p' || e === 'P') && src[i] === '{') return to('}')
  if (e !== undefined && e >= '0' && e <= '9') while (src[i]! >= '0' && src[i]! <= '9') i++
  return i
}

// Splits at top-level |.
function alternativesOf(src: string): string[] {
  const out: string[] = []
  let start = 0
  for (let i = 0; i < src.length; i++) {
    const c = src[i]
    if (c === '\\') i++
    else if (c === '(' || c === '[') i = skip(src, i) - 1
    else if (c === '|') { out.push(src.slice(start, i)); start = i + 1 }
  }
  out.push(src.slice(start))
  return out
}

// Body of a group that every match passes through, or null for a negative lookaround.
// Lookaheads, lookbehinds, and modifier groups like (?-i:…) still need their text present.
function groupBody(group: string): string | null {
  if (!group.endsWith(')')) return null
  const inner = group.slice(1, -1)
  if (inner.startsWith('?!') || inner.startsWith('?<!')) return null
  if (inner.startsWith('?<=')) return inner.slice(3)
  if (inner.startsWith('?=')) return inner.slice(2)
  if (inner.startsWith('?<')) return inner.slice(inner.indexOf('>') + 1)
  if (inner.startsWith('?')) return inner.slice(inner.indexOf(':') + 1)
  return inner
}

// The ASCII runs (lowercased) and the groups that every match of this alternative contains.
function partsOf(src: string): { runs: string[]; groups: string[] } {
  const runs: string[] = []
  const groups: string[] = []
  let run = ''
  const flush = () => { if (run) runs.push(run); run = '' }
  let i = 0
  while (i < src.length) {
    const c = src[i]!
    let ch: string | null = null
    let group: string | null = null
    let next = i + 1
    if (c === '\\') {
      const e = src[i + 1]
      next = i + 2
      if (e !== undefined && ESCAPED_LITERAL.test(e)) ch = e
      else next = escapeEnd(src, next, e)
    } else if (c === '(' || c === '[') {
      next = skip(src, i)
      if (c === '(') group = src.slice(i, next)
    } else if (!QUANTIFIER.test(c) && c !== '.' && c !== '^' && c !== '$') {
      ch = c
    }
    if (ch !== null && ch.charCodeAt(0) >= 128) ch = null
    const q = src[next]
    // ?, *, and {0,} make the item optional; + and {n,} with n >= 1 keep one copy.
    const quantified = q !== undefined && QUANTIFIER.test(q)
    const optional = quantified && (q === '?' || q === '*' || src.startsWith('{0', next))
    if (group !== null && !optional) groups.push(group)
    if (quantified) {
      if (ch !== null && !optional) run += ch.toLowerCase()
      flush()
      if (q === '{') next = src.indexOf('}', next) < 0 ? src.length : src.indexOf('}', next)
      next++
      if (src[next] === '?') next++
    } else if (ch !== null) {
      run += ch.toLowerCase()
    } else {
      flush()
    }
    i = next
  }
  flush()
  return { runs, groups }
}

const longest = (runs: string[]) => runs.reduce((a, b) => (b.length > a.length ? b : a), '')

// Required literals in conjunctive form: the regex can match only if, for every clause,
// the page contains one of the clause's literals. null when there is no clause with
// literals of at least `min` characters (the rule then always runs).
// - one top-level alternative: each run is a clause, and each required group whose
//   alternatives all have a run is a clause of those runs;
// - several top-level alternatives: one clause of the longest run of each.
export function requiredLiterals(pattern: string, min = 3): string[][] | null {
  const alternatives = alternativesOf(pattern)
  if (alternatives.length > 1) {
    const clause = alternatives.map((a) => longest(partsOf(a).runs))
    return clause.every((l) => l.length >= min) ? [clause] : null
  }
  const { runs, groups } = partsOf(pattern)
  const clauses = runs.filter((r) => r.length >= min).map((r) => [r])
  for (const group of groups) {
    const body = groupBody(group)
    if (body === null) continue
    const clause = alternativesOf(body).map((a) => longest(partsOf(a).runs))
    if (clause.every((l) => l.length >= min)) clauses.push(clause)
  }
  return clauses.length > 0 ? clauses : null
}

// Aho-Corasick automaton as a dense table over the characters that occur in the literals.
// ASCII letters match in both cases; any other character resets to the root, because
// a case-insensitive regex never matches an ASCII literal character with a non-ASCII one.
// Literals must be lowercase ASCII, as requiredLiterals returns them.
export class LiteralSet {
  private readonly classOf = new Uint8Array(128)
  private readonly width: number
  private readonly delta: Int32Array
  private readonly out: number[][]
  readonly size: number

  constructor(literals: string[]) {
    this.size = literals.length
    let classes = 1
    for (const literal of literals) {
      for (let i = 0; i < literal.length; i++) {
        const c = literal.charCodeAt(i)
        if (this.classOf[c] === 0) this.classOf[c] = classes++
      }
    }
    for (let c = 65; c <= 90; c++) this.classOf[c] = this.classOf[c + 32]!
    this.width = classes

    const edges: Array<Map<number, number>> = [new Map()]
    const own: number[][] = [[]]
    literals.forEach((literal, id) => {
      let state = 0
      for (let i = 0; i < literal.length; i++) {
        const k = this.classOf[literal.charCodeAt(i)]!
        let child = edges[state]!.get(k)
        if (child === undefined) {
          child = edges.length
          edges.push(new Map())
          own.push([])
          edges[state]!.set(k, child)
        }
        state = child
      }
      own[state]!.push(id)
    })

    const width = this.width
    const delta = new Int32Array(edges.length * width)
    const fail = new Int32Array(edges.length)
    this.out = own
    const queue = [0]
    for (let q = 0; q < queue.length; q++) {
      const state = queue[q]!
      for (let k = 0; k < width; k++) {
        const child = edges[state]!.get(k)
        const fallback = state === 0 ? 0 : delta[fail[state]! * width + k]!
        if (child === undefined) { delta[state * width + k] = fallback; continue }
        delta[state * width + k] = child
        fail[child] = fallback
        if (this.out[fallback]!.length > 0) this.out[child] = [...this.out[child]!, ...this.out[fallback]!]
        queue.push(child)
      }
    }
    this.delta = delta
  }

  // present[id] === 1 when literal id occurs in text (case-insensitive).
  scan(text: string): Uint8Array {
    const present = new Uint8Array(this.size)
    const { classOf, width, delta, out } = this
    let state = 0
    for (let i = 0; i < text.length; i++) {
      const c = text.charCodeAt(i)
      state = c < 128 ? delta[state * width + classOf[c]!]! : 0
      const ids = out[state]!
      for (let j = 0; j < ids.length; j++) present[ids[j]!] = 1
    }
    return present
  }
}
