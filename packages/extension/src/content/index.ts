import { collectSignals, sanitizeJsPayload } from './collect'
import { ext } from '../shared/ext'
import { CAPS, MAIN_WORLD_SOURCE, type MainWorldMessage, type ToContent } from '../shared/protocol'
// DOM_SELECTORS and JS_PATHS are injected at build time (Task 8) via the "virtual:lists" module
import { DOM_SELECTORS, JS_PATHS } from 'virtual:lists'

let jsGlobals: Record<string, unknown> = {}

function send() {
  const signals = { ...collectSignals(document, location.href, DOM_SELECTORS), js: jsGlobals }
  ext.runtime.sendMessage({ type: 'signals', signals }).catch(() => {})
}

window.addEventListener('message', (event: MessageEvent) => {
  if (event.source !== window) return
  const data = event.data as MainWorldMessage
  if (data?.source !== MAIN_WORLD_SOURCE) return
  jsGlobals = sanitizeJsPayload(data.js, JS_PATHS, CAPS.jsValue)
  send()
})

ext.runtime.onMessage.addListener((msg: ToContent) => {
  if (msg.type === 'recollect') send()
})

send()
