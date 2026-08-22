import { extractSignals } from './extract'
import type { SignalBundle } from '@opentechcheck/core'

export { extractSignals }

export type CollectErrorCode = 'fetch_failed' | 'timeout' | 'http_error' | 'non_html'

export type CollectResult =
  | { ok: true; bundle: SignalBundle }
  | { ok: false; error: { code: CollectErrorCode; message: string } }

export interface CollectOptions {
  timeoutMs?: number
  fetch?: typeof fetch
}

export async function collect(url: string, options: CollectOptions = {}): Promise<CollectResult> {
  const timeoutMs = options.timeoutMs ?? 10_000
  const doFetch = options.fetch ?? fetch
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  try {
    const res = await doFetch(url, { redirect: 'follow', signal: controller.signal })
    if (!res.ok) {
      return { ok: false, error: { code: 'http_error', message: `HTTP ${res.status}` } }
    }
    const type = res.headers.get('content-type') ?? ''
    if (!type.includes('text/html')) {
      return { ok: false, error: { code: 'non_html', message: `content-type: ${type || 'none'}` } }
    }
    const html = await res.text()
    return { ok: true, bundle: extractSignals(res.url || url, html, res.headers) }
  } catch (err) {
    const code: CollectErrorCode =
      err instanceof DOMException && err.name === 'AbortError' ? 'timeout' : 'fetch_failed'
    return { ok: false, error: { code, message: String(err) } }
  } finally {
    clearTimeout(timer)
  }
}
