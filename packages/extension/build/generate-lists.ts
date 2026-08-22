import type { Fingerprint } from '@opentechcheck/core'

function keysOf(fps: Fingerprint[], source: 'js' | 'dom'): string[] {
  const keys = new Set<string>()
  for (const fp of fps) {
    for (const key of Object.keys(fp.detect[source] ?? {})) keys.add(key)
  }
  return [...keys].sort()
}

export const jsPaths = (fps: Fingerprint[]) => keysOf(fps, 'js')
export const domSelectors = (fps: Fingerprint[]) => keysOf(fps, 'dom')
