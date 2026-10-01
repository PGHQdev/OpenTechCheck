import type { Fingerprint } from '@opentechcheck/core'
import type { DomReads } from '../src/shared/protocol'

function keysOf(fps: Fingerprint[], source: 'js' | 'dom'): string[] {
  const keys = new Set<string>()
  for (const fp of fps) {
    for (const key of Object.keys(fp.detect[source] ?? {})) keys.add(key)
  }
  return [...keys].sort()
}

export const jsPaths = (fps: Fingerprint[]) => keysOf(fps, 'js')
export const domSelectors = (fps: Fingerprint[]) => keysOf(fps, 'dom')

export function domReads(fps: Fingerprint[]): DomReads {
  const reads = new Map<string, { attrs: Set<string>; text: boolean }>()
  for (const fp of fps) {
    for (const [selector, rules] of Object.entries(fp.detect.dom ?? {})) {
      for (const rule of rules) {
        if (rule.attr === undefined && !rule.text) continue
        const read = reads.get(selector) ?? { attrs: new Set<string>(), text: false }
        if (rule.attr !== undefined) read.attrs.add(rule.attr)
        if (rule.text) read.text = true
        reads.set(selector, read)
      }
    }
  }
  const out: DomReads = {}
  for (const selector of [...reads.keys()].sort()) {
    const read = reads.get(selector)!
    out[selector] = { attrs: [...read.attrs].sort(), text: read.text }
  }
  return out
}
