import type { Detection } from '@opentechcheck/core'

export interface PageSignals {
  url: string
  html: string
  meta: Record<string, string[]>       // lowercase name/property -> contents
  scripts: string[]
  dom: string[]                        // selectors that matched
  js: Record<string, unknown>          // dotted path -> capped string value
}

export type ToBackground =
  | { type: 'signals'; signals: PageSignals }
  | { type: 'get-result' }
export type ToContent = { type: 'recollect' }

export interface TabResult {
  url: string
  detections: Detection[]
}

export const MAIN_WORLD_SOURCE = 'opentechcheck-js-globals'
export interface MainWorldMessage {
  source: typeof MAIN_WORLD_SOURCE
  js: Record<string, unknown>
}

export const CAPS = { html: 500_000, scripts: 500, jsValue: 200 } as const
