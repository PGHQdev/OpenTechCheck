import { detect, type Fingerprint } from '@opentechcheck/core'
import registry from '@opentechcheck/fingerprints'
import { toBundle, toCookieRecord, toHeaderTable } from './assemble'
import { clearTab, clearTabResult, getTab, setTab } from './store'
import { ext } from '../shared/ext'
import type { PageSignals, ScanState, TabResult, ToBackground, ToContent } from '../shared/protocol'
import { createAutoReporter, eligibleForAutoReport, type PageConnection } from './auto-report'
import { publicDomain } from '../../../reporting/domain'

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
  reportEmpty?(tabId: number, result: TabResult): Promise<void>
}

async function detectAndStore(api: BackgroundApi, tabId: number, signals: PageSignals, scan?: ScanState): Promise<TabResult> {
  const headers = await getTab<Record<string, string[]>>(api.session, 'headers', tabId)
  const cookies = toCookieRecord(await api.getCookies(signals.url))
  const bundle = toBundle(signals, headers ?? undefined, cookies)
  const detections = detect(bundle, fingerprints)
  const result: TabResult = { url: signals.url, detections, ...(scan ? { scan } : {}) }
  await setTab(api.session, 'result', tabId, result)
  api.setBadge(tabId, detections.length > 0 ? String(detections.length) : '')
  return result
}

export function createBackground(api: BackgroundApi): void {
  const timers = new Map<number, unknown>()
  const queues = new Map<number, Promise<unknown>>()
  const enqueue = <T>(tabId: number, task: () => Promise<T>): Promise<T> => {
    const next = (queues.get(tabId) ?? Promise.resolve()).catch(() => {}).then(task)
    queues.set(tabId, next)
    void next.finally(() => { if (queues.get(tabId) === next) queues.delete(tabId) }).catch(() => {})
    return next
  }

  api.onHeaders((tabId, url, headers) => {
    return enqueue(tabId, async () => {
      await setTab(api.session, 'headers', tabId, toHeaderTable(headers))
      const signals = await getTab<PageSignals>(api.session, 'signals', tabId)
      const result = await getTab<TabResult>(api.session, 'result', tabId)
      if (signals && signals.url.split('#')[0] === url.split('#')[0]) await detectAndStore(api, tabId, signals, result?.scan)
    }).catch(() => {})
  })

  api.onMessage(async (msg: ToBackground, tabId) => {
    try {
      if (msg.type === 'signals' && tabId !== undefined) {
        await enqueue(tabId, async () => {
          const previous = await getTab<TabResult>(api.session, 'result', tabId)
          if (msg.scan && previous?.scan?.document === msg.scan.document && previous.scan.sequence > msg.scan.sequence) return
          await setTab(api.session, 'signals', tabId, msg.signals)
          const result = await detectAndStore(api, tabId, msg.signals, msg.scan)
          if (msg.scan?.completed && msg.scan.settled && result.detections.length === 0) {
            // Do not block subsequent detections while reporting. The reporter
            // rechecks tab, consent and scan identity immediately before sending.
            void api.reportEmpty?.(tabId, result).catch(() => {})
          }
        })
        return
      }
      if (msg.type === 'get-result' && tabId !== undefined) {
        return await enqueue(tabId, () => getTab<TabResult>(api.session, 'result', tabId))
      }
      return null
    } catch { return null }
  })

  api.onCommitted((tabId) => {
    return enqueue(tabId, async () => {
      await clearTabResult(api.session, tabId)
      api.setBadge(tabId, '')
    }).catch(() => {})
  })

  api.onHistoryUpdated((tabId) => {
    const prev = timers.get(tabId)
    if (prev !== undefined) api.clearTimer(prev)
    timers.set(tabId, api.setTimer(() => {
      timers.delete(tabId)
      api.sendToTab(tabId, { type: 'recollect' } satisfies ToContent).catch(() => {})
    }, api.debounceMs))
  })

  api.onTabRemoved((tabId) => {
    const timer = timers.get(tabId)
    if (timer !== undefined) api.clearTimer(timer)
    timers.delete(tabId)
    return enqueue(tabId, () => clearTab(api.session, tabId)).catch(() => {})
  })
}

function realApi(c: typeof chrome): BackgroundApi {
  const reporter = createAutoReporter({
    storage: c.storage.local,
    now: () => Date.now(),
    fetch: (url, init) => fetch(url, init),
    eligible: async (tabId, scanId) => {
      const tab = await c.tabs.get(tabId)
      const result = await getTab<TabResult>(c.storage.session, 'result', tabId)
      const connection = await getTab<PageConnection>(c.storage.session, 'connection', tabId)
      return eligibleForAutoReport(tab, result, connection, scanId)
    },
  })
  c.storage.onChanged.addListener((changes, area) => {
    if (area === 'local' && changes.autoReportEnabled && changes.autoReportEnabled.newValue !== true) reporter.cancel()
  })
  // Require a successful public-network document response. Unknown/cached
  // addresses are skipped rather than risking disclosure of an internal host.
  c.webNavigation.onBeforeNavigate.addListener((d) => {
    if (d.frameId === 0) c.storage.session.remove(`connection:${d.tabId}`).catch(() => {})
  })
  c.webRequest.onCompleted.addListener((d) => {
    if (d.tabId >= 0) setTab(c.storage.session, 'connection', d.tabId, { url: d.url, ip: d.ip, status: d.statusCode }).catch(() => {})
  }, { urls: ['<all_urls>'], types: ['main_frame'] })
  c.webRequest.onErrorOccurred.addListener((d) => {
    if (d.tabId >= 0) c.storage.session.remove(`connection:${d.tabId}`).catch(() => {})
  }, { urls: ['<all_urls>'], types: ['main_frame'] })
  return {
    reportEmpty: async (tabId, result) => {
      const domain = publicDomain(new URL(result.url).hostname)
      if (domain && result.scan) await reporter.report(domain, tabId, result.scan.id)
    },
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
