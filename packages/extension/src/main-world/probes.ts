const REACT_PREFIXES = ['__reactFiber$', '__reactContainer$', '_reactRootContainer']
const SCAN_CAP = 1500

export function runProbes(doc: Document, win: unknown): Record<string, string> {
  const out: Record<string, string> = {}
  try {
    let reactFound = false
    let vueAppEl: unknown = null
    let vueFound = false

    let elements: NodeListOf<Element> | undefined
    try {
      elements = doc.querySelectorAll('*')
    } catch { /* hostile doc */ }

    const limit = Math.min(elements?.length ?? 0, SCAN_CAP)
    for (let i = 0; i < limit; i++) {
      const el = elements![i]!
      let keys: string[]
      try {
        keys = Object.getOwnPropertyNames(el)
      } catch { continue }

      if (!reactFound) {
        reactFound = keys.some((k) => REACT_PREFIXES.some((prefix) => k.startsWith(prefix)))
      }
      if (!vueFound) {
        if (keys.includes('__vue_app__')) { vueFound = true; vueAppEl = el }
        else if (keys.includes('__vue__')) { vueFound = true }
      }
    }

    if (!vueFound) {
      try {
        vueFound = Boolean((win as Record<string, unknown>)?.['__VUE__'])
      } catch { /* hostile getter */ }
    }

    if (reactFound) {
      let version: unknown
      try {
        version = (win as Record<string, { version?: unknown }>)?.['React']?.version
      } catch { /* hostile getter */ }
      out['$probe.react'] = typeof version === 'string' ? version : 'detected'
    }

    if (vueFound) {
      let version: unknown
      try {
        version = (vueAppEl as { __vue_app__?: { version?: unknown } } | null)?.__vue_app__?.version
      } catch { /* hostile getter */ }
      out['$probe.vue'] = typeof version === 'string' ? version : 'detected'
    }
  } catch { /* probes are best-effort */ }
  return out
}
