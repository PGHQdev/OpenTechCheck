import { collectSignals, sanitizeJsPayload } from './collect'
import { createScanScheduler } from './scan-scheduler'
import { ext } from '../shared/ext'
import { CAPS, MAIN_WORLD_REQUEST, MAIN_WORLD_SOURCE, type MainWorldMessage, type ScanState, type ToContent } from '../shared/protocol'
import { DOM_SELECTORS, JS_PATHS } from 'virtual:lists'

// getRandomValues also works on ordinary HTTP pages, unlike randomUUID.
const token = () => Array.from(crypto.getRandomValues(new Uint32Array(4)), (n) => n.toString(16)).join('-')
let route = location.href
let documentKey = token()
let sequence = 0
let completedScans = 0
let jsGlobals: Record<string, unknown> = {}
let pending: { url: string; scan: ScanState } | null = null

function send(scan: ScanState) {
  const signals = { ...collectSignals(document, location.href, DOM_SELECTORS), js: jsGlobals }
  ext.runtime.sendMessage({ type: 'signals', signals, scan }).catch(() => {})
}

function freshScan(settled: boolean) {
  if (route !== location.href) { start(); return }
  const scan: ScanState = { id: token(), document: documentKey, sequence: ++sequence, completed: false, settled: false }
  pending = { url: route, scan: { ...scan, settled } }
  // Show DOM/header detections promptly, but never report an incomplete scan.
  send(scan)
  window.postMessage({ source: MAIN_WORLD_REQUEST, requestId: scan.id }, location.origin)
}

const scheduler = createScanScheduler({
  now: () => Date.now(), scan: freshScan,
  setTimer: (fn, ms) => setTimeout(fn, ms),
  clearTimer: (id) => clearTimeout(id as ReturnType<typeof setTimeout>),
})

window.addEventListener('message', (event: MessageEvent) => {
  if (event.source !== window) return
  const data = event.data as MainWorldMessage
  if (data?.source !== MAIN_WORLD_SOURCE) return
  if (data.shadowChanged === true) { changed(); return }
  if (!pending || data.requestId !== pending.scan.id || pending.url !== location.href) return
  jsGlobals = sanitizeJsPayload(data.js, JS_PATHS, CAPS.jsValue)
  const complete = data.probesComplete === true
  if (complete) completedScans++
  send({ ...pending.scan, completed: complete, settled: complete && pending.scan.settled && completedScans >= 2 && document.readyState === 'complete' })
  pending = null
})

function changed() {
  // A page change during a yielding probe pass invalidates its quiet-page claim.
  if (pending) pending.scan.settled = false
  scheduler.changed()
}
const observer = new MutationObserver((records) => {
  if (records.some((record) => record.type === 'attributes' ||
    [...record.addedNodes, ...record.removedNodes].some((node) => node.nodeType === Node.ELEMENT_NODE || ['SCRIPT', 'STYLE'].includes(node.parentElement?.tagName ?? '')))) changed()
})

function start() {
  route = location.href; documentKey = token(); sequence = completedScans = 0; jsGlobals = {}; pending = null
  observer.disconnect()
  // Fingerprints include arbitrary data-*, x-* and hx-* attributes, so do not
  // narrow this to a fixed list. The scheduler bounds the cost of rescanning.
  observer.observe(document.documentElement, { subtree: true, childList: true, attributes: true })
  scheduler.start()
}

ext.runtime.onMessage.addListener((msg: ToContent, _sender, respond) => {
  if (msg.type !== 'recollect') return
  if (route !== location.href) start()
  else scheduler.refresh()
  respond({ ok: true })
})

// Script loading and consent interactions may change globals or cookies without
// a further DOM mutation. These share the observer's throttled scan schedule.
document.addEventListener('load', changed, true)
document.addEventListener('click', changed, { passive: true })
document.addEventListener('change', changed, { passive: true })
document.addEventListener('visibilitychange', () => { if (!document.hidden) scheduler.refresh() })
window.addEventListener('pagehide', () => { observer.disconnect(); scheduler.dispose(); pending = null })
window.addEventListener('pageshow', (event) => { if (event.persisted) start() })
start()
