import { CAPS, type PageSignals } from '../shared/protocol'

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

export function collectSignals(
  doc: Document, url: string, selectors: string[],
): Omit<PageSignals, 'js'> {
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
  for (const sel of selectors) {
    try { if (doc.querySelector(sel)) dom.push(sel) } catch { /* invalid selector */ }
  }
  const html = doc.documentElement?.outerHTML.slice(0, CAPS.html) ?? ''
  return { url, html, meta, scripts, dom }
}
