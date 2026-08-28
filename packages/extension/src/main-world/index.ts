import { readGlobals } from './read-globals'
import { runProbes } from './probes'
import { CAPS, MAIN_WORLD_REQUEST, MAIN_WORLD_SOURCE } from '../shared/protocol'
import { JS_PATHS } from 'virtual:lists'

function post(): void {
  window.postMessage(
    {
      source: MAIN_WORLD_SOURCE,
      js: { ...readGlobals(window, JS_PATHS, CAPS.jsValue), ...runProbes(document, window) },
    },
    location.origin,
  )
}

// Cross-world injection order is not guaranteed: the isolated-world listener
// may not exist yet when this first post fires, and SPA recollects need a
// fresh read. The content script re-requests via MAIN_WORLD_REQUEST.
window.addEventListener('message', (event: MessageEvent) => {
  if (event.source !== window) return
  if ((event.data as { source?: string })?.source !== MAIN_WORLD_REQUEST) return
  post()
})

post()
