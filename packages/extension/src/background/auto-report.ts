import { publicAddress, publicDomain } from '../../../reporting/domain'
import type { TabResult } from '../shared/protocol'

export interface PageConnection { url: string; ip?: string; status: number }
export function eligibleForAutoReport(
  tab: { url?: string; incognito?: boolean }, result: TabResult | null,
  connection: PageConnection | null, scanId: string,
): boolean {
  return tab.incognito === false && !!tab.url && tab.url === result?.url &&
    result.scan?.id === scanId && result.scan.completed && result.scan.settled && result.detections.length === 0 &&
    !!connection && new URL(connection.url).origin === new URL(tab.url).origin &&
    connection.status >= 200 && connection.status < 400 && publicAddress(connection.ip)
}

export interface AutoReportApi {
  storage: { get(key: string): Promise<Record<string, unknown>>; set(values: Record<string, unknown>): Promise<void> }
  now(): number
  eligible(tabId: number, scanId: string): Promise<boolean>
  fetch(url: string, init: RequestInit): Promise<Response>
}
interface History { day: string; attempts: number; domains: Record<string, number> }
const DAY = 86_400_000
const HISTORY_KEY = 'automaticReportHistory'

export function createAutoReporter(api: AutoReportApi) {
  let queue = Promise.resolve()
  let current: AbortController | undefined
  let generation = 0
  async function send(domain: string, tabId: number, scanId: string, expectedGeneration: number) {
    if (!publicDomain(domain) || (await api.storage.get('autoReportEnabled')).autoReportEnabled !== true) return
    if (!await api.eligible(tabId, scanId)) return
    const now = api.now()
    const day = new Date(now).toISOString().slice(0, 10)
    const previous = (await api.storage.get(HISTORY_KEY))[HISTORY_KEY] as History | undefined
    const history: History = { day, attempts: previous?.day === day ? previous.attempts : 0, domains: previous?.domains ?? {} }
    const hash = Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(domain))), (b) => b.toString(16).padStart(2, '0')).join('')
    if (history.attempts >= 10 || (history.domains[hash] !== undefined && now - history.domains[hash]! < 30 * DAY)) return
    if (generation !== expectedGeneration || (await api.storage.get('autoReportEnabled')).autoReportEnabled !== true || !await api.eligible(tabId, scanId)) return
    history.domains = Object.fromEntries(Object.entries(history.domains).filter(([, time]) => now - time < 30 * DAY).sort((a, b) => b[1] - a[1]).slice(0, 499))
    history.domains[hash] = now
    history.attempts++
    // Record attempts before sending: lost responses and service-worker restarts
    // must not turn a domain into repeated background submissions.
    await api.storage.set({ [HISTORY_KEY]: history })
    if (generation !== expectedGeneration || (await api.storage.get('autoReportEnabled')).autoReportEnabled !== true || !await api.eligible(tabId, scanId)) return
    // Consent can change while either awaited check is in flight.
    if (generation !== expectedGeneration) return
    current = new AbortController()
    const timeout = setTimeout(() => current?.abort(), 10_000)
    try {
      await api.fetch('https://opentechcheck.com/api/reports/automatic', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        credentials: 'omit', referrerPolicy: 'no-referrer', redirect: 'error',
        body: JSON.stringify({ domain }), signal: current.signal,
      })
    } finally { clearTimeout(timeout); current = undefined }
  }
  return {
    report(domain: string, tabId: number, scanId: string): Promise<void> {
      const expectedGeneration = generation
      queue = queue.then(() => send(domain, tabId, scanId, expectedGeneration)).catch(() => { /* best effort; no page data logged */ })
      return queue
    },
    cancel() { generation++; current?.abort() },
  }
}
