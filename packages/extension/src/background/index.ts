import { detect, type Fingerprint } from '@opentechcheck/core'
import registry from '@opentechcheck/fingerprints'
import { toBundle, toCookieRecord, toHeaderTable } from './assemble'
import { clearTab, clearTabResult, getTab, setTab } from './store'
import { ext } from '../shared/ext'
import type { PageSignals, TabResult, ToBackground, ToContent } from '../shared/protocol'

const fingerprints = registry as unknown as Fingerprint[]

export interface BackgroundApi {
  session: { get(k: string): Promise<Record<string, unknown>>; set(i: Record<string, unknown>): Promise<void>; remove(k: string | string[]): Promise<void> }
  getCookies(url: string): Promise<Array<{ name: string; value: string }>>
  setBadge(tabId: number, text: string): void
  sendToTab(tabId: number, msg: ToContent): Promise<void>
  onHeaders(cb: (tabId: number, url: string, headers: Array<{ name: string; value?: string }>) => void): void
  onMessage(cb: (msg: ToBackground, tabId: number | undefined) => Promise<unknown> | void): void
  onCommitted(cb: (tabId: number) => void): void          // main-frame new document
  onHistoryUpdated(cb: (tabId: number) => void): void      // SPA navigation
  onTabRemoved(cb: (tabId: number) => void): void
  debounceMs: number
  setTimer(fn: () => void, ms: number): unknown
  clearTimer(t: unknown): void
}

async function detectAndStore(api: BackgroundApi, tabId: number, signals: PageSignals): Promise<void> {
  const headers = await getTab<Record<string, string[]>>(api.session, 'headers', tabId)
  const cookies = toCookieRecord(await api.getCookies(signals.url))
  const bundle = toBundle(signals, headers ?? undefined, cookies)
  const detections = detect(bundle, fingerprints)
  const result: TabResult = { url: signals.url, detections }
  await setTab(api.session, 'result', tabId, result)
  api.setBadge(tabId, detections.length > 0 ? String(detections.length) : '')
}

export function createBackground(api: BackgroundApi): void {
  const timers = new Map<number, unknown>()

  api.onHeaders((tabId, url, headers) => {
    return (async () => {
      await setTab(api.session, 'headers', tabId, toHeaderTable(headers))
      const signals = await getTab<PageSignals>(api.session, 'signals', tabId)
      if (signals && signals.url === url) await detectAndStore(api, tabId, signals)
    })().catch(console.warn)
  })

  api.onMessage(async (msg: ToBackground, tabId) => {
    try {
      if (msg.type === 'signals' && tabId !== undefined) {
        await setTab(api.session, 'signals', tabId, msg.signals)
        await detectAndStore(api, tabId, msg.signals)
        return
      }
      if (msg.type === 'get-result' && tabId !== undefined) {
        return await getTab<TabResult>(api.session, 'result', tabId)
      }
      return null
    } catch (err) { console.warn('opentechcheck:', err); return null }
  })

  api.onCommitted((tabId) => {
    clearTabResult(api.session, tabId).catch(console.warn)
    api.setBadge(tabId, '')
  })

  api.onHistoryUpdated((tabId) => {
    const prev = timers.get(tabId)
    if (prev !== undefined) api.clearTimer(prev)
    timers.set(tabId, api.setTimer(() => {
      timers.delete(tabId)
      api.sendToTab(tabId, { type: 'recollect' } satisfies ToContent).catch(() => {})
    }, api.debounceMs))
  })

  api.onTabRemoved((tabId) => { clearTab(api.session, tabId).catch(console.warn) })
}

function realApi(c: typeof chrome): BackgroundApi {
  return {
    session: {
      get: (k) => c.storage.session.get(k),
      set: (i) => c.storage.session.set(i),
      remove: (k) => c.storage.session.remove(k),
    },
    getCookies: (url) => c.cookies.getAll({ url }),
    setBadge: (tabId, text) => { c.action.setBadgeText({ tabId, text }).catch(() => {}) },
    sendToTab: (tabId, msg) => c.tabs.sendMessage(tabId, msg),
    onHeaders: (cb) => c.webRequest.onHeadersReceived.addListener(
      (d) => { if (d.tabId >= 0) cb(d.tabId, d.url, d.responseHeaders ?? []) },
      { urls: ['<all_urls>'], types: ['main_frame'] }, ['responseHeaders'],
    ),
    onMessage: (cb) => c.runtime.onMessage.addListener((msg, sender, sendResponse) => {
      const tabId = sender.tab?.id ?? undefined
      const resolveTab = tabId !== undefined
        ? Promise.resolve(tabId)
        : c.tabs.query({ active: true, currentWindow: true }).then((t) => t[0]?.id)
      resolveTab.then((id) => cb(msg, id)).then(sendResponse, () => sendResponse(null))
      return true
    }),
    onCommitted: (cb) => c.webNavigation.onCommitted.addListener((d) => { if (d.frameId === 0) cb(d.tabId) }),
    onHistoryUpdated: (cb) => c.webNavigation.onHistoryStateUpdated.addListener((d) => { if (d.frameId === 0) cb(d.tabId) }),
    onTabRemoved: (cb) => c.tabs.onRemoved.addListener((id) => cb(id)),
    debounceMs: 500,
    setTimer: (fn, ms) => setTimeout(fn, ms),
    clearTimer: (t) => clearTimeout(t as ReturnType<typeof setTimeout>),
  }
}

if (typeof (globalThis as { Bun?: unknown }).Bun === 'undefined') {
  createBackground(realApi(ext))
}
