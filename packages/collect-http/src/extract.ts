import type { SignalBundle } from '@opentechcheck/core'

const SCRIPT_SRC = /<script\b[^>]*?(?<![\w-])src\s*=\s*["']([^"']+)["']/gi
const META_TAG = /<meta\b[^>]*>/gi
const ATTR = (name: string) => new RegExp(`(?:^|\\s)${name}\\s*=\\s*["']([^"']*)["']`, 'i')

export function extractSignals(url: string, html: string, headers: Headers): SignalBundle {
  const scripts = Array.from(html.matchAll(SCRIPT_SRC), (m) => m[1] ?? '')

  const meta: Record<string, string[]> = {}
  for (const m of html.matchAll(META_TAG)) {
    const tag = m[0]
    const name = ATTR('name').exec(tag)?.[1] ?? ATTR('property').exec(tag)?.[1]
    const content = ATTR('content').exec(tag)?.[1]
    if (!name || content === undefined) continue
    const key = name.toLowerCase()
    ;(meta[key] ??= []).push(content)
  }

  const headerTable: Record<string, string[]> = {}
  const cookies: Record<string, string> = {}
  headers.forEach((value, key) => {
    const k = key.toLowerCase()
    ;(headerTable[k] ??= []).push(value)
    if (k === 'set-cookie') {
      const [pair] = value.split(';')
      const eq = pair?.indexOf('=') ?? -1
      if (pair && eq > 0) cookies[pair.slice(0, eq).trim()] = pair.slice(eq + 1).trim()
    }
  })

  return { url, html, scripts, meta, headers: headerTable, cookies }
}
