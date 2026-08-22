import { expect, test } from 'bun:test'
import { getTab, setTab, clearTab } from '../src/background/store'

function fakeArea() {
  const m = new Map<string, unknown>()
  return {
    m,
    get: async (k: string) => (m.has(k) ? { [k]: m.get(k) } : {}),
    set: async (obj: Record<string, unknown>) => { for (const [k, v] of Object.entries(obj)) m.set(k, v) },
    remove: async (keys: string | string[]) => { for (const k of [keys].flat()) m.delete(k) },
  }
}

test('set/get/clear round-trip per tab', async () => {
  const area = fakeArea()
  await setTab(area as any, 'headers', 7, { server: ['nginx'] })
  await setTab(area as any, 'result', 7, { url: 'u', detections: [] })
  const headers = await getTab<Record<string, string[]>>(area as any, 'headers', 7)
  expect(headers).toEqual({ server: ['nginx'] })
  await clearTab(area as any, 7)
  const headersAfterClear = await getTab<Record<string, string[]>>(area as any, 'headers', 7)
  const resultAfterClear = await getTab<{ url: string; detections: [] }>(area as any, 'result', 7)
  expect(headersAfterClear).toBeNull()
  expect(resultAfterClear).toBeNull()
})
