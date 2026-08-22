export function resolveExt(): typeof chrome {
  const g = globalThis as Record<string, unknown>
  return (g.browser ?? g.chrome) as typeof chrome
}
export const ext: typeof chrome = resolveExt()
