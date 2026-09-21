// Shared by the extension and report endpoint. No DNS lookup or target fetch.
export function publicDomain(value: string): string | null {
  if (value.length > 253 || value !== value.toLowerCase() || !value.includes('.')) return null
  const labels = value.split('.')
  if (labels.some((label) => !/^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/.test(label))) return null
  const suffix = labels.at(-1)!
  if (/^\d+$/.test(suffix) || ['localhost', 'local', 'internal', 'intranet', 'lan', 'home', 'arpa', 'test', 'invalid', 'example', 'onion'].includes(suffix)) return null
  if (value === 'opentechcheck.com' || value.endsWith('.opentechcheck.com')) return null
  return value
}

// Fail closed when no public remote address was observed for this document.
export function publicAddress(ip: string | undefined): boolean {
  if (!ip) return false
  const v4 = ip.split('.').map(Number)
  if (v4.length === 4 && v4.every((n) => Number.isInteger(n) && n >= 0 && n <= 255)) {
    const [a, b, c] = v4 as [number, number, number, number]
    return !(a === 0 || a === 10 || a === 127 || a >= 224 ||
      (a === 100 && b >= 64 && b <= 127) || (a === 169 && b === 254) ||
      (a === 172 && b >= 16 && b <= 31) || (a === 192 && (b === 168 || b === 0 || (b === 88 && c === 99))) ||
      (a === 198 && (b === 18 || b === 19 || (b === 51 && c === 100))) || (a === 203 && b === 0 && c === 113))
  }
  try {
    const normalized = new URL(`http://[${ip}]/`).hostname.slice(1, -1)
    // Only global unicast; exclude special-purpose 2001::/23 and documentation.
    if (!/^[23][0-9a-f]{3}:/.test(normalized)) return false
    const parts = normalized.split(':')
    return !(parts[0] === '2001' && (parseInt(parts[1] || '0', 16) < 0x200 || parts[1] === 'db8')) && !normalized.startsWith('3fff:')
  } catch { return false }
}
