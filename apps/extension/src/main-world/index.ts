import { readGlobals } from './read-globals'
import { createShadowWatcher } from './shadow-watcher'
import { runProbes } from './probes'
import { createProbeQueue } from './probe-queue'
import { CAPS, MAIN_WORLD_REQUEST, MAIN_WORLD_SOURCE } from '../shared/protocol'
import { JS_PATHS } from 'virtual:lists'

const shadows = createShadowWatcher(MutationObserver, () => window.postMessage(
  { source: MAIN_WORLD_SOURCE, shadowChanged: true }, location.origin,
))

const queue = createProbeQueue({
  url: () => location.href,
  scan: async (signal) => {
    const revision = shadows.revision()
    const result = await runProbes(document, window, { signal, onShadowRoot: shadows.observe })
    if (shadows.revision() !== revision) result.complete = false
    return result
  },
  send: (requestId, result) => window.postMessage(
    {
      source: MAIN_WORLD_SOURCE,
      requestId,
      probesComplete: result.complete,
      js: { ...readGlobals(window, JS_PATHS, CAPS.jsValue), ...result.js },
    },
    location.origin,
  ),
})

// The content script requests fresh reads for initial collection, follow-ups,
// and SPA navigation. Startup follow-ups also cover cross-world injection order.
window.addEventListener('message', (event: MessageEvent) => {
  if (event.source !== window) return
  if ((event.data as { source?: string })?.source !== MAIN_WORLD_REQUEST) return
  const requestId = (event.data as { requestId?: unknown }).requestId
  if (typeof requestId === 'string') queue.request(requestId)
})

window.addEventListener('pagehide', () => { queue.cancel(); shadows.disconnect() })
