// Elements whose contents are not page text.
const SKIP = new Set(['script', 'style', 'noscript', 'template'])
const NAMED: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ' }
// Bounded repeats keep this linear.
const REFERENCE = /&(?:#(\d{1,7})|#x([0-9a-f]{1,6})|([a-z]{2,4}));/gi

function decode(text: string): string {
  return text.replace(REFERENCE, (ref, dec?: string, hex?: string, name?: string) => {
    if (name !== undefined) return NAMED[name.toLowerCase()] ?? ref
    const code = dec !== undefined ? Number(dec) : parseInt(hex!, 16)
    return code > 0 && code <= 0x10ffff ? String.fromCodePoint(code) : '�'
  })
}

// Text of an html string: tags become spaces; comments and SKIP contents drop out.
// Index scans only, so the cost is linear in html.length.
export function pageText(html: string): string {
  const lower = html.toLowerCase()
  const parts: string[] = []
  let i = 0
  while (i < html.length) {
    const lt = lower.indexOf('<', i)
    if (lt < 0) { parts.push(html.slice(i)); break }
    if (!/[a-z/!?]/.test(lower[lt + 1] ?? '')) { parts.push(html.slice(i, lt + 1)); i = lt + 1; continue }
    parts.push(html.slice(i, lt))
    if (lower.startsWith('<!--', lt)) {
      const end = lower.indexOf('-->', lt + 4)
      i = end < 0 ? html.length : end + 3
      continue
    }
    parts.push(' ')
    const gt = lower.indexOf('>', lt + 1)
    if (gt < 0) break
    let end = lt + 1
    while (end < gt && /[a-z0-9-]/.test(lower[end]!)) end++
    const name = lower.slice(lt + 1, end)
    i = gt + 1
    if (SKIP.has(name)) {
      const close = lower.indexOf(`</${name}`, i)
      i = close < 0 ? html.length : close
    }
  }
  return decode(parts.join('')).replace(/\s+/g, ' ').trim()
}
