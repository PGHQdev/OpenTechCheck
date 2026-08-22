export type Source =
  | 'html' | 'scripts' | 'headers' | 'meta' | 'cookies' | 'js' | 'dom' | 'implied'

export interface Rule {
  pattern: string          // regex source, compiled with 'i'; '' means presence-only
  version?: number         // capture group index holding the version
  confidence?: number      // 0-100, default 100
}

export interface Detect {
  html?: Rule[]
  scripts?: Rule[]
  headers?: Record<string, Rule[]>   // key: lowercase header name
  meta?: Record<string, Rule[]>      // key: lowercase meta name/property
  cookies?: Record<string, Rule[]>   // key: exact cookie name
  js?: Record<string, Rule[]>        // key: dotted global path, e.g. "React.version"
  dom?: Record<string, Rule[]>       // key: CSS selector present in bundle.dom
}

export interface Fingerprint {
  name: string
  slug: string
  category: string
  website: string
  implies?: string[]
  excludes?: string[]
  detect: Detect
}

export interface SignalBundle {
  url: string
  html?: string
  headers?: Record<string, string[]>   // lowercase names
  cookies?: Record<string, string>
  meta?: Record<string, string[]>      // lowercase names -> content values
  scripts?: string[]                    // script src URLs
  js?: Record<string, unknown>          // dotted path -> sampled value
  dom?: string[]                        // selectors that matched in the page
}

export interface Evidence {
  source: Source
  pattern: string
  match: string
  key?: string             // header/meta/cookie/js/dom key, when applicable
}

export interface Detection {
  slug: string
  name: string
  category: string
  confidence: number       // 0-100
  version: string | null
  evidence: Evidence[]
}

export interface DetectOptions {
  onWarning?: (message: string) => void
}
