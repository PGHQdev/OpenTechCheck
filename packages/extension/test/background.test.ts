import { expect, test } from 'bun:test'
import { createBackground, type BackgroundApi } from '../src/background/index'
import type { PageSignals } from '../src/shared/protocol'

function fakeApi() {
  const m = new Map<string, unknown>()
  const calls = { badge: [] as Array<[number, string]>, sent: [] as Array<[number, unknown]> }
  const handlers: any = {}
  const timers: Array<{ fn: () => void }> = []
  const api: BackgroundApi = {
    session: {
      get: async (k) => (m.has(k) ? { [k]: m.get(k) } : {}),
      set: async (i) => { for (const [k, v] of Object.entries(i)) m.set(k, v) },
      remove: async (keys) => { for (const k of [keys].flat()) m.delete(k) },
    },
    getCookies: async () => [{ name: 'sid', value: 'abc' }],
    setBadge: (id, text) => calls.badge.push([id, text]),
    sendToTab: async (id, msg) => { calls.sent.push([id, msg]) },
    onHeaders: (cb) => { handlers.headers = cb },
    onMessage: (cb) => { handlers.message = cb },
    onCommitted: (cb) => { handlers.committed = cb },
    onHistoryUpdated: (cb) => { handlers.history = cb },
    onTabRemoved: (cb) => { handlers.removed = cb },
    debounceMs: 500,
    setTimer: (fn) => { const t = { fn }; timers.push(t); return t },
    clearTimer: (t) => { const i = timers.indexOf(t as any); if (i >= 0) timers.splice(i, 1) },
  }
  return { api, m, calls, handlers, timers }
}

const signals: PageSignals = {
  url: 'https://example.com/', html: '<div id="__next"></div><script src="/_next/static/x.js"></script>',
  meta: {}, scripts: ['/_next/static/chunk.js'], dom: [], js: {},
}

test('signals message runs detection, stores result, sets badge', async () => {
  const { api, m, calls, handlers } = fakeApi()
  createBackground(api)
  handlers.headers(3, signals.url, [{ name: 'Server', value: 'nginx/1.25.0' }])
  await handlers.message({ type: 'signals', signals }, 3)
  const result = m.get('result:3') as any
  const slugs = result.detections.map((d: any) => d.slug)
  expect(slugs).toContain('nextjs')
  expect(slugs).toContain('nginx')
  expect(calls.badge.at(-1)?.[0]).toBe(3)
  expect(Number(calls.badge.at(-1)?.[1])).toBeGreaterThan(0)
})

test('get-result returns stored result or null', async () => {
  const { api, handlers } = fakeApi()
  createBackground(api)
  expect(await handlers.message({ type: 'get-result' }, 9)).toBeNull()
  await handlers.message({ type: 'signals', signals }, 9)
  const res: any = await handlers.message({ type: 'get-result' }, 9)
  expect(res.url).toBe('https://example.com/')
})

test('committed clears result and badge but keeps headers', async () => {
  const { api, m, calls, handlers } = fakeApi()
  createBackground(api)
  handlers.headers(4, signals.url, [{ name: 'Server', value: 'nginx' }])
  await handlers.message({ type: 'signals', signals }, 4)
  await handlers.committed(4)
  expect(m.has('result:4')).toBe(false)
  expect(m.has('headers:4')).toBe(true)
  expect(calls.badge.at(-1)).toEqual([4, ''])
})

test('history updates debounce into one recollect', async () => {
  const { api, calls, handlers, timers } = fakeApi()
  createBackground(api)
  handlers.history(5); handlers.history(5); handlers.history(5)
  expect(timers.length).toBe(1)
  timers[0]!.fn()
  await Promise.resolve()
  expect(calls.sent).toEqual([[5, { type: 'recollect' }]])
})

test('a $probe.react signal detects react with version', async () => {
  const { api, m, handlers } = fakeApi()
  createBackground(api)
  const probeSignals: PageSignals = { ...signals, js: { '$probe.react': '18.3.1' } }
  await handlers.message({ type: 'signals', signals: probeSignals }, 7)
  const result = m.get('result:7') as any
  const react = result.detections.find((d: any) => d.slug === 'react')
  expect(react).toBeDefined()
  expect(react.version).toBe('18.3.1')
})

test('tab removal clears both keys', async () => {
  const { api, m, handlers } = fakeApi()
  createBackground(api)
  handlers.headers(6, signals.url, [{ name: 'Server', value: 'nginx' }])
  await handlers.message({ type: 'signals', signals }, 6)
  await handlers.removed(6)
  expect(m.size).toBe(0)
})

test('headers arriving after signals still produce header-based detections', async () => {
  const { api, m, handlers } = fakeApi()
  createBackground(api)
  await handlers.message({ type: 'signals', signals }, 10)
  const firstResult = m.get('result:10') as any
  expect(firstResult.detections.map((d: any) => d.slug)).not.toContain('nginx')
  await handlers.headers(10, signals.url, [{ name: 'Server', value: 'nginx/1.25.0' }])
  const result = m.get('result:10') as any
  const slugs = result.detections.map((d: any) => d.slug)
  expect(slugs).toContain('nextjs')
  expect(slugs).toContain('nginx')
})

test('late headers do not duplicate or corrupt the badge', async () => {
  const { api, calls, handlers } = fakeApi()
  createBackground(api)
  await handlers.message({ type: 'signals', signals }, 11)
  const beforeCount = Number(calls.badge.at(-1)?.[1])
  await handlers.headers(11, signals.url, [{ name: 'Server', value: 'nginx/1.25.0' }])
  expect(calls.badge.at(-1)?.[0]).toBe(11)
  const afterCount = Number(calls.badge.at(-1)?.[1])
  expect(afterCount).toBeGreaterThan(beforeCount)
  expect(calls.badge.length).toBe(2)
})

test('committed clears result and signals; a late header event after commit does not resurrect a result', async () => {
  const { api, m, handlers } = fakeApi()
  createBackground(api)
  handlers.headers(12, signals.url, [{ name: 'Server', value: 'nginx' }])
  await handlers.message({ type: 'signals', signals }, 12)
  await handlers.committed(12)
  expect(m.has('result:12')).toBe(false)
  expect(m.has('signals:12')).toBe(false)
  expect(m.has('headers:12')).toBe(true)
  await handlers.headers(12, signals.url, [{ name: 'Server', value: 'nginx' }])
  expect(m.has('result:12')).toBe(false)
})

test('same-tab navigation: headers for the new document do not mix with the old document\'s stored signals', async () => {
  const { api, m, calls, handlers } = fakeApi()
  createBackground(api)
  await handlers.message({ type: 'signals', signals }, 13)
  const badgeCallsBefore = calls.badge.length
  const resultBefore = m.get('result:13') as any
  const otherUrl = 'https://other-site.example/'
  await handlers.headers(13, otherUrl, [{ name: 'Server', value: 'nginx/1.25.0' }])
  expect(m.get('headers:13')).toBeDefined()
  const resultAfter = m.get('result:13') as any
  expect(resultAfter).toEqual(resultBefore)
  expect(resultAfter.url).toBe(signals.url)
  expect(resultAfter.detections.map((d: any) => d.slug)).not.toContain('nginx')
  expect(calls.badge.length).toBe(badgeCallsBefore)
})
