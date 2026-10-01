import type { Detection } from '@opentechcheck/core'

export interface PageSignals {
  url: string
  html: string
  meta: Record<string, string[]>       // lowercase name/property -> contents
  scripts: string[]
  dom: string[]                        // selectors that matched
  domAttrs?: Record<string, Record<string, string[]>>  // selector -> attribute -> distinct values
  domText?: Record<string, string[]>                     // selector -> distinct collapsed texts
  js: Record<string, unknown>          // dotted path -> capped string value
}

// Selectors whose element values the collector reads (built from dom attr/text rules).
export type DomReads = Record<string, { attrs: string[]; text: boolean }>

export type ToBackground =
  | { type: 'signals'; signals: PageSignals; scan?: ScanState }
  | { type: 'get-result' }
export type ToContent = { type: 'recollect' }

export interface TabResult {
  url: string
  detections: Detection[]
  scan?: ScanState
}

export interface ScanState {
  id: string
  document: string
  sequence: number
  completed: boolean
  settled: boolean
}

export const MAIN_WORLD_SOURCE = 'opentechcheck-js-globals'
export const MAIN_WORLD_REQUEST = 'opentechcheck-js-request'
export interface MainWorldMessage {
  source: typeof MAIN_WORLD_SOURCE
  js: Record<string, unknown>
  requestId?: string
  probesComplete?: boolean
  shadowChanged?: boolean
}

export const CAPS = {
  html: 500_000, scripts: 500, jsValue: 200,
  domMatches: 50, domValue: 10_000, domTotal: 500_000,
} as const
