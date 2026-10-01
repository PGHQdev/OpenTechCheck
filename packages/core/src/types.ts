export type Source =
  | 'html' | 'scripts' | 'headers' | 'meta' | 'cookies' | 'js' | 'dom' | 'url' | 'text' | 'implied'

export interface Rule {
  pattern: string          // regex source, compiled with 'i'; '' means presence-only
  version?: number         // capture group index holding the version
  confidence?: number      // 0-100, default 100
}

export interface DomRule extends Rule {
  attr?: string            // match the values of this attribute
  text?: true              // match the collapsed text content
}

export interface Within {
  techs?: string[]         // any listed tech present opens the gate
  categories?: string[]    // so does any present tech in a listed category
}

export interface Detect {
  html?: Rule[]
  url?: Rule[]                       // matched against bundle.url
  text?: Rule[]                      // matched against the page text derived from html
  scripts?: Rule[]
  headers?: Record<string, Rule[]>   // key: lowercase header name
  meta?: Record<string, Rule[]>      // key: lowercase meta name/property
  cookies?: Record<string, Rule[]>   // key: exact cookie name
  js?: Record<string, Rule[]>        // key: dotted global path, e.g. "React.version"
  dom?: Record<string, DomRule[]>    // key: CSS selector present in bundle.dom
}

export interface Fingerprint {
  name: string
  slug: string
  category: string
  website: string
  implies?: string[]
  excludes?: string[]
  within?: Within
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
  domAttrs?: Record<string, Record<string, string[]>>  // selector -> attribute -> distinct values
  domText?: Record<string, string[]>                     // selector -> distinct collapsed texts
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
