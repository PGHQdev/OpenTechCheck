import { readGlobals } from './read-globals'
import { CAPS, MAIN_WORLD_SOURCE } from '../shared/protocol'
import { JS_PATHS } from 'virtual:lists'

window.postMessage(
  { source: MAIN_WORLD_SOURCE, js: readGlobals(window, JS_PATHS, CAPS.jsValue) },
  location.origin,
)
