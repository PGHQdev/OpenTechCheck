type Area = {
  get(key: string): Promise<Record<string, unknown>>
  set(items: Record<string, unknown>): Promise<void>
  remove(keys: string | string[]): Promise<void>
}
type Kind = 'headers' | 'result' | 'signals'
const key = (kind: Kind, tabId: number) => `${kind}:${tabId}`

export async function getTab<T>(area: Area, kind: Kind, tabId: number): Promise<T | null> {
  const k = key(kind, tabId)
  const got = await area.get(k)
  return (got[k] as T | undefined) ?? null
}
export const setTab = (area: Area, kind: Kind, tabId: number, value: unknown) =>
  area.set({ [key(kind, tabId)]: value })
export const clearTab = (area: Area, tabId: number) =>
  area.remove([key('headers', tabId), key('result', tabId), key('signals', tabId)])
export const clearTabResult = (area: Area, tabId: number) =>
  area.remove([key('result', tabId), key('signals', tabId)])
