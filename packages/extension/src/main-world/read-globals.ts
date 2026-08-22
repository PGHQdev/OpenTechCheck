export function readGlobals(
  root: unknown, paths: string[], cap: number,
): Record<string, unknown> {
  const out: Record<string, unknown> = {}
  for (const path of paths) {
    try {
      let value: unknown = root
      for (const part of path.split('.')) {
        if (value === undefined || value === null) break
        value = (value as Record<string, unknown>)[part]
      }
      if (value === undefined || value === null) continue
      out[path] = String(value).slice(0, cap)
    } catch { /* hostile getter */ }
  }
  return out
}
