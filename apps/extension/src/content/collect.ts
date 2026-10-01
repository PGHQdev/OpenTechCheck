import { CAPS, type DomReads, type PageSignals } from '../shared/protocol'

export function sanitizeJsPayload(
  js: unknown, paths: string[], cap: number,
): Record<string, unknown> {
  const out: Record<string, unknown> = {}
  if (js === null || typeof js !== 'object') return out
  const source = js as Record<string, unknown>
  for (const path of paths) {
    if (!(path in source)) continue
    out[path] = String(source[path]).slice(0, cap)
  }
  return out
}

// Element 1 of every selector, then element 2, and so on, so one broad selector
// cannot use the whole domTotal budget.
function readDomValues(matches: Array<[string, Element[]]>, reads: DomReads) {
  const domAttrs: Record<string, Record<string, string[]>> = {}
  const domText: Record<string, string[]> = {}
  let budget: number = CAPS.domTotal
  const add = (list: string[], raw: string) => {
    const value = raw.slice(0, Math.min(CAPS.domValue, budget))
    if (list.includes(value)) return
    list.push(value)
    budget -= value.length
  }
  for (let i = 0; i < CAPS.domMatches && budget > 0; i++) {
    for (const [selector, elements] of matches) {
      const el = elements[i]
      if (!el || budget <= 0) continue
      const read = reads[selector]!
      for (const attr of read.attrs) {
        const value = el.getAttribute(attr)
        if (value !== null && budget > 0) add((domAttrs[selector] ??= {})[attr] ??= [], value)
      }
      if (read.text && budget > 0) add(domText[selector] ??= [], (el.textContent ?? '').replace(/\s+/g, ' ').trim())
    }
  }
  return { domAttrs, domText }
}

export function collectSignals(
  doc: Document, url: string, selectors: string[], reads: DomReads = {},
): Required<Omit<PageSignals, 'js'>> {
  const meta: Record<string, string[]> = {}
  for (const el of doc.querySelectorAll('meta')) {
    const key = (el.getAttribute('name') ?? el.getAttribute('property'))?.toLowerCase()
    const content = el.getAttribute('content')
    if (!key || content === null) continue
    ;(meta[key] ??= []).push(content)
  }
  const scripts: string[] = []
  for (const el of doc.querySelectorAll('script[src]')) {
    if (scripts.length >= CAPS.scripts) break
    scripts.push((el as HTMLScriptElement).src || el.getAttribute('src') || '')
  }
  const dom: string[] = []
  const matches: Array<[string, Element[]]> = []
  for (const sel of selectors) {
    try {
      if (!reads[sel]) { if (doc.querySelector(sel)) dom.push(sel); continue }
      const list = doc.querySelectorAll(sel)
      if (list.length === 0) continue
      dom.push(sel)
      matches.push([sel, Array.from({ length: Math.min(list.length, CAPS.domMatches) }, (_, i) => list[i]!)])
    } catch { /* invalid selector */ }
  }
  const html = doc.documentElement?.outerHTML.slice(0, CAPS.html) ?? ''
  return { url, html, meta, scripts, dom, ...readDomValues(matches, reads) }
}
