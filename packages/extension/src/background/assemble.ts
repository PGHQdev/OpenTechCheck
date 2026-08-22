import type { SignalBundle } from '@opentechcheck/core'
import type { PageSignals } from '../shared/protocol'

export function toHeaderTable(
  headers: Array<{ name: string; value?: string }>,
): Record<string, string[]> {
  const out: Record<string, string[]> = {}
  for (const h of headers) (out[h.name.toLowerCase()] ??= []).push(h.value ?? '')
  return out
}

export function toCookieRecord(
  cookies: Array<{ name: string; value: string }>,
): Record<string, string> {
  const out: Record<string, string> = {}
  for (const c of cookies) if (!(c.name in out)) out[c.name] = c.value
  return out
}

export function toBundle(
  signals: PageSignals,
  headers: Record<string, string[]> | undefined,
  cookies: Record<string, string>,
): SignalBundle {
  return {
    url: signals.url, html: signals.html, meta: signals.meta, scripts: signals.scripts,
    dom: signals.dom, js: signals.js, headers, cookies,
  }
}
