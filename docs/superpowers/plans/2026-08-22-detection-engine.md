# Detection Engine and Fingerprint Registry Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build `@opentechcheck/core` (pure matcher), `@opentechcheck/fingerprints` (YAML registry + compiler), and `@opentechcheck/collect-http` (fetch collector), with a fixture test harness, CI, and the first 10 fingerprints.

**Architecture:** Collectors turn a page into a plain `SignalBundle`; a pure function `detect(bundle, fingerprints)` applies compiled fingerprints and returns detections with confidence, version, and evidence. Fingerprints are YAML data compiled to one JSON artifact at build time.

**Tech Stack:** TypeScript, Bun workspaces, Bun test runner. Dev-time deps in the fingerprints package only: `yaml` (parse), `ajv` (JSON Schema validation). `@opentechcheck/core` and `@opentechcheck/collect-http` have zero runtime dependencies.

**Spec:** `docs/superpowers/specs/2026-08-22-detection-engine-design.md`

**Coverage note:** This plan delivers the engine plus the first 10 fingerprints. Scaling to ~100 technologies is repeat content work after this plan, following the loop in CONTRIBUTING.md (Task 13).

## Global Constraints

- All packages are TypeScript, ESM (`"type": "module"`).
- `@opentechcheck/core` and `@opentechcheck/collect-http`: zero runtime dependencies, no Node-only APIs (must run in browsers, Bun/Node, Cloudflare Workers).
- Patterns compile case-insensitive: `new RegExp(pattern, 'i')`.
- Header names and meta names are lowercase everywhere (bundle and fingerprint keys).
- License: Apache-2.0.
- Every commit: run `bun test` at repo root first; commit only on green.
- Commit messages: conventional prefix (`feat:`, `test:`, `chore:`), no co-author trailers.

---

### Task 1: Monorepo scaffold

**Files:**
- Create: `package.json`, `tsconfig.base.json`, `.gitignore`, `LICENSE`, `packages/core/package.json`, `packages/core/tsconfig.json`, `packages/core/src/index.ts`, `packages/core/test/smoke.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces: workspace layout every later task builds in; `packages/core/src/index.ts` re-exports the whole core API.

- [ ] **Step 1: Root files**

`package.json`:

```json
{
  "name": "opentechcheck-monorepo",
  "private": true,
  "type": "module",
  "workspaces": ["packages/*"],
  "scripts": {
    "test": "bun test",
    "typecheck": "bunx tsc --noEmit -p packages/core && bunx tsc --noEmit -p packages/fingerprints && bunx tsc --noEmit -p packages/collect-http"
  },
  "devDependencies": {
    "typescript": "^5.6.0"
  }
}
```

`tsconfig.base.json`:

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "skipLibCheck": true,
    "declaration": true,
    "types": ["bun-types"]
  }
}
```

`.gitignore`:

```text
node_modules/
dist/
*.log
```

`LICENSE`: full Apache-2.0 text (copy from https://www.apache.org/licenses/LICENSE-2.0.txt), copyright line: `Copyright 2026 OpenTechCheck contributors`.

- [ ] **Step 2: Core package skeleton**

`packages/core/package.json`:

```json
{
  "name": "@opentechcheck/core",
  "version": "0.0.1",
  "type": "module",
  "license": "Apache-2.0",
  "main": "src/index.ts",
  "exports": { ".": "./src/index.ts" }
}
```

`packages/core/tsconfig.json`:

```json
{ "extends": "../../tsconfig.base.json", "include": ["src", "test"] }
```

`packages/core/src/index.ts`:

```ts
export const VERSION = '0.0.1'
```

- [ ] **Step 3: Write smoke test**

`packages/core/test/smoke.test.ts`:

```ts
import { expect, test } from 'bun:test'
import { VERSION } from '../src/index'

test('core package loads', () => {
  expect(VERSION).toBe('0.0.1')
})
```

- [ ] **Step 4: Install and run**

Run: `bun install && bun test`
Expected: 1 pass.

Run: `bunx tsc --noEmit -p packages/core` (add `bun-types` to root devDependencies if the compiler cannot find Bun types: `bun add -d bun-types`)
Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add -A && git commit -m "chore: scaffold bun workspaces monorepo with core package"
```

---

### Task 2: Core types and matching for html and scripts

**Files:**
- Create: `packages/core/src/types.ts`, `packages/core/src/match.ts`, `packages/core/src/detect.ts`
- Modify: `packages/core/src/index.ts`
- Test: `packages/core/test/detect.test.ts`

**Interfaces:**
- Consumes: Task 1 layout.
- Produces (used by every later task):
  - `detect(bundle: SignalBundle, fingerprints: Fingerprint[], options?: DetectOptions): Detection[]`
  - All types below, exported from `@opentechcheck/core`.

- [ ] **Step 1: Write the types**

`packages/core/src/types.ts`:

```ts
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
```

- [ ] **Step 2: Write the failing test**

`packages/core/test/detect.test.ts`:

```ts
import { expect, test } from 'bun:test'
import { detect } from '../src/index'
import type { Fingerprint, SignalBundle } from '../src/index'

const nextjs: Fingerprint = {
  name: 'Next.js', slug: 'nextjs', category: 'web-framework',
  website: 'https://nextjs.org',
  detect: {
    html: [{ pattern: '__NEXT_DATA__' }],
    scripts: [{ pattern: '/_next/static/' }],
  },
}

test('detects via html pattern with evidence', () => {
  const bundle: SignalBundle = { url: 'https://a.com', html: '<script id="__NEXT_DATA__">' }
  const [d] = detect(bundle, [nextjs])
  expect(d?.slug).toBe('nextjs')
  expect(d?.evidence[0]).toEqual({ source: 'html', pattern: '__NEXT_DATA__', match: '__NEXT_DATA__' })
})

test('detects via script URL', () => {
  const bundle: SignalBundle = { url: 'https://a.com', scripts: ['https://a.com/_next/static/x.js'] }
  expect(detect(bundle, [nextjs])[0]?.slug).toBe('nextjs')
})

test('matching is case-insensitive', () => {
  const bundle: SignalBundle = { url: 'https://a.com', html: '__next_data__' }
  expect(detect(bundle, [nextjs])).toHaveLength(1)
})

test('absent fields are skipped, no match no detection', () => {
  expect(detect({ url: 'https://a.com' }, [nextjs])).toHaveLength(0)
})
```

- [ ] **Step 3: Run test to verify it fails**

Run: `bun test packages/core/test/detect.test.ts`
Expected: FAIL (`detect` not exported).

- [ ] **Step 4: Implement**

`packages/core/src/match.ts`:

```ts
import type { Evidence, Rule, Source } from './types'

export interface RuleHit {
  rule: Rule
  evidence: Evidence
  captures: string[]       // regex capture groups (index 1 = captures[1])
}

const MAX_MATCH_LEN = 100

export function runRule(
  rule: Rule, source: Source, text: string, key?: string,
): RuleHit | null {
  if (rule.pattern === '') {
    return { rule, captures: [], evidence: { source, pattern: '', match: '', ...(key ? { key } : {}) } }
  }
  const re = new RegExp(rule.pattern, 'i')
  const m = re.exec(text)
  if (!m) return null
  return {
    rule,
    captures: Array.from(m, (g) => g ?? ''),
    evidence: {
      source,
      pattern: rule.pattern,
      match: (m[0] ?? '').slice(0, MAX_MATCH_LEN),
      ...(key ? { key } : {}),
    },
  }
}
```

`packages/core/src/detect.ts`:

```ts
import { runRule, type RuleHit } from './match'
import type { Detection, DetectOptions, Fingerprint, SignalBundle } from './types'

export function collectHits(fp: Fingerprint, bundle: SignalBundle, options: DetectOptions): RuleHit[] {
  const hits: RuleHit[] = []
  const d = fp.detect
  for (const rule of d.html ?? []) {
    if (bundle.html === undefined) break
    const h = runRule(rule, 'html', bundle.html)
    if (h) hits.push(h)
  }
  for (const rule of d.scripts ?? []) {
    for (const src of bundle.scripts ?? []) {
      const h = runRule(rule, 'scripts', src)
      if (h) { hits.push(h); break }
    }
  }
  return hits
}

export function toDetection(fp: Fingerprint, hits: RuleHit[]): Detection {
  return {
    slug: fp.slug,
    name: fp.name,
    category: fp.category,
    confidence: 100,                    // real math in Task 4
    version: null,                      // real resolution in Task 5
    evidence: hits.map((h) => h.evidence),
  }
}

export function detect(
  bundle: SignalBundle, fingerprints: Fingerprint[], options: DetectOptions = {},
): Detection[] {
  const out: Detection[] = []
  for (const fp of fingerprints) {
    const hits = collectHits(fp, bundle, options)
    if (hits.length > 0) out.push(toDetection(fp, hits))
  }
  return out
}
```

`packages/core/src/index.ts`:

```ts
export const VERSION = '0.0.1'
export * from './types'
export { detect } from './detect'
```

- [ ] **Step 5: Run tests, verify pass**

Run: `bun test`
Expected: all pass.

- [ ] **Step 6: Commit**

```bash
git add -A && git commit -m "feat(core): types and matcher for html and scripts sources"
```

---

### Task 3: Keyed sources — headers, meta, cookies, js, dom

**Files:**
- Modify: `packages/core/src/detect.ts` (extend `collectHits`)
- Test: `packages/core/test/keyed-sources.test.ts`

**Interfaces:**
- Consumes: `runRule`, `collectHits` from Task 2.
- Produces: `collectHits` covers all seven bundle sources. Semantics: for keyed sources, the fingerprint key selects the bundle entry; the rule pattern runs against each value; empty pattern `''` matches presence of the key.

- [ ] **Step 1: Write the failing test**

`packages/core/test/keyed-sources.test.ts`:

```ts
import { expect, test } from 'bun:test'
import { detect } from '../src/index'
import type { Fingerprint } from '../src/index'

const cf: Fingerprint = {
  name: 'Cloudflare', slug: 'cloudflare', category: 'cdn', website: 'https://www.cloudflare.com',
  detect: {
    headers: {
      server: [{ pattern: 'cloudflare' }],
      'cf-ray': [{ pattern: '' }],
    },
  },
}

const wp: Fingerprint = {
  name: 'WordPress', slug: 'wordpress', category: 'cms', website: 'https://wordpress.org',
  detect: { meta: { generator: [{ pattern: 'WordPress' }] } },
}

const shop: Fingerprint = {
  name: 'Shopify', slug: 'shopify', category: 'ecommerce', website: 'https://www.shopify.com',
  detect: { cookies: { _shopify_s: [{ pattern: '' }] } },
}

const react: Fingerprint = {
  name: 'React', slug: 'react', category: 'js-framework', website: 'https://react.dev',
  detect: {
    js: { 'React.version': [{ pattern: '.' }] },
    dom: { '[data-reactroot]': [{ pattern: '' }] },
  },
}

test('header value pattern and header presence', () => {
  const out = detect({ url: 'u', headers: { server: ['cloudflare'], 'cf-ray': ['abc'] } }, [cf])
  expect(out[0]?.evidence.map((e) => e.key).sort()).toEqual(['cf-ray', 'server'])
})

test('meta generator', () => {
  const out = detect({ url: 'u', meta: { generator: ['WordPress 6.5'] } }, [wp])
  expect(out[0]?.slug).toBe('wordpress')
})

test('cookie presence', () => {
  expect(detect({ url: 'u', cookies: { _shopify_s: 'x' } }, [shop])[0]?.slug).toBe('shopify')
})

test('js global and dom selector', () => {
  const out = detect({ url: 'u', js: { 'React.version': '18.3.1' }, dom: ['[data-reactroot]'] }, [react])
  expect(out[0]?.evidence).toHaveLength(2)
})

test('keyed source with missing key does not match', () => {
  expect(detect({ url: 'u', headers: {} }, [cf])).toHaveLength(0)
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun test packages/core/test/keyed-sources.test.ts`
Expected: FAIL (no detections for keyed sources).

- [ ] **Step 3: Implement**

Extend `collectHits` in `packages/core/src/detect.ts` (after the scripts loop):

```ts
  const keyedText: Array<['headers' | 'meta', Record<string, string[]> | undefined]> = [
    ['headers', bundle.headers],
    ['meta', bundle.meta],
  ]
  for (const [source, table] of keyedText) {
    const spec = d[source]
    if (!spec || !table) continue
    for (const [key, rules] of Object.entries(spec)) {
      const values = table[key]
      if (values === undefined) continue
      for (const rule of rules) {
        for (const value of values.length > 0 ? values : ['']) {
          const h = runRule(rule, source, value, key)
          if (h) { hits.push(h); break }
        }
      }
    }
  }
  for (const [key, rules] of Object.entries(d.cookies ?? {})) {
    const value = bundle.cookies?.[key]
    if (value === undefined) continue
    for (const rule of rules) {
      const h = runRule(rule, 'cookies', value, key)
      if (h) hits.push(h)
    }
  }
  for (const [key, rules] of Object.entries(d.js ?? {})) {
    if (!bundle.js || !(key in bundle.js)) continue
    const value = String(bundle.js[key] ?? '')
    for (const rule of rules) {
      const h = runRule(rule, 'js', value, key)
      if (h) hits.push(h)
    }
  }
  for (const [key, rules] of Object.entries(d.dom ?? {})) {
    if (!bundle.dom?.includes(key)) continue
    for (const rule of rules) {
      const h = runRule(rule, 'dom', '', key)
      if (h) hits.push(h)
    }
  }
```

Also fix the Task 2 html loop so `break` does not skip later sources (guard before the loop instead):

```ts
  if (bundle.html !== undefined) {
    for (const rule of d.html ?? []) {
      const h = runRule(rule, 'html', bundle.html)
      if (h) hits.push(h)
    }
  }
```

Note on `dom` rules: the selector key carries the whole test; rules there should use pattern `''`. A non-empty pattern runs against the empty string and only matches if the regex accepts `''`.

- [ ] **Step 4: Run tests, verify pass**

Run: `bun test`
Expected: all pass (including Task 2 tests).

- [ ] **Step 5: Commit**

```bash
git add -A && git commit -m "feat(core): keyed sources - headers, meta, cookies, js, dom"
```

---

### Task 4: Confidence aggregation and deterministic output order

**Files:**
- Modify: `packages/core/src/detect.ts` (`toDetection`, `detect`)
- Test: `packages/core/test/confidence.test.ts`

**Interfaces:**
- Consumes: `RuleHit[]` from `collectHits`.
- Produces: confidence = max rule confidence + 5 per additional distinct source, capped 100. Output sorted by confidence desc, then slug asc.

- [ ] **Step 1: Write the failing test**

`packages/core/test/confidence.test.ts`:

```ts
import { expect, test } from 'bun:test'
import { detect } from '../src/index'
import type { Fingerprint } from '../src/index'

const fp = (slug: string, d: Fingerprint['detect']): Fingerprint => ({
  name: slug, slug, category: 'cms', website: 'https://x.com', detect: d,
})

test('single low-confidence rule', () => {
  const f = fp('a', { html: [{ pattern: 'aaa', confidence: 40 }] })
  expect(detect({ url: 'u', html: 'aaa' }, [f])[0]?.confidence).toBe(40)
})

test('max rule wins within one source', () => {
  const f = fp('a', { html: [{ pattern: 'aaa', confidence: 40 }, { pattern: 'bbb', confidence: 70 }] })
  expect(detect({ url: 'u', html: 'aaa bbb' }, [f])[0]?.confidence).toBe(70)
})

test('+5 per additional distinct source, capped at 100', () => {
  const f = fp('a', {
    html: [{ pattern: 'aaa', confidence: 90 }],
    scripts: [{ pattern: 'bbb', confidence: 10 }],
    meta: { generator: [{ pattern: 'ccc', confidence: 10 }] },
  })
  const bundle = { url: 'u', html: 'aaa', scripts: ['bbb'], meta: { generator: ['ccc'] } }
  expect(detect(bundle, [f])[0]?.confidence).toBe(100)  // 90 + 5 + 5
})

test('cap at 100', () => {
  const f = fp('a', { html: [{ pattern: 'aaa' }], scripts: [{ pattern: 'bbb' }] })
  expect(detect({ url: 'u', html: 'aaa', scripts: ['bbb'] }, [f])[0]?.confidence).toBe(100)
})

test('output sorted by confidence desc then slug asc', () => {
  const low = fp('zeta', { html: [{ pattern: 'x', confidence: 30 }] })
  const hi = fp('alpha', { html: [{ pattern: 'x', confidence: 90 }] })
  const tie = fp('beta', { html: [{ pattern: 'x', confidence: 90 }] })
  const out = detect({ url: 'u', html: 'x' }, [low, tie, hi])
  expect(out.map((d) => d.slug)).toEqual(['alpha', 'beta', 'zeta'])
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun test packages/core/test/confidence.test.ts`
Expected: FAIL (confidence hardcoded 100, no sort).

- [ ] **Step 3: Implement**

In `toDetection`:

```ts
  const maxConf = Math.max(...hits.map((h) => h.rule.confidence ?? 100))
  const sources = new Set(hits.map((h) => h.evidence.source))
  const confidence = Math.min(100, maxConf + 5 * (sources.size - 1))
```

At the end of `detect`:

```ts
  out.sort((a, b) => b.confidence - a.confidence || a.slug.localeCompare(b.slug))
```

- [ ] **Step 4: Run tests, verify pass**

Run: `bun test`
Expected: all pass.

- [ ] **Step 5: Commit**

```bash
git add -A && git commit -m "feat(core): confidence aggregation and deterministic ordering"
```

---

### Task 5: Version resolution

**Files:**
- Modify: `packages/core/src/detect.ts` (`toDetection`)
- Test: `packages/core/test/version.test.ts`

**Interfaces:**
- Consumes: `RuleHit.captures` from Task 2.
- Produces: `Detection.version` — among rules with a non-empty capture at index `rule.version`, highest confidence wins; ties break by hit order (source order html → scripts → headers → meta → cookies → js → dom, then file order within a source, which is the order `collectHits` already produces).

- [ ] **Step 1: Write the failing test**

`packages/core/test/version.test.ts`:

```ts
import { expect, test } from 'bun:test'
import { detect } from '../src/index'
import type { Fingerprint } from '../src/index'

const fp = (d: Fingerprint['detect']): Fingerprint => ({
  name: 'X', slug: 'x', category: 'cms', website: 'https://x.com', detect: d,
})

test('captures version from group index', () => {
  const f = fp({ meta: { generator: [{ pattern: 'WordPress\\s([\\d.]+)', version: 1 }] } })
  const out = detect({ url: 'u', meta: { generator: ['WordPress 6.5.2'] } }, [f])
  expect(out[0]?.version).toBe('6.5.2')
})

test('no version rule -> null', () => {
  const f = fp({ html: [{ pattern: 'x' }] })
  expect(detect({ url: 'u', html: 'x' }, [f])[0]?.version).toBeNull()
})

test('empty capture does not win over non-empty', () => {
  const f = fp({
    html: [{ pattern: 'v(?:ersion=([\\d.]+))?', version: 1, confidence: 100 }],
    scripts: [{ pattern: 'lib-([\\d.]+)\\.js', version: 1, confidence: 50 }],
  })
  const out = detect({ url: 'u', html: 'v', scripts: ['lib-2.1.0.js'] }, [f])
  expect(out[0]?.version).toBe('2.1.0')
})

test('higher-confidence rule wins version conflicts', () => {
  const f = fp({
    scripts: [{ pattern: 'lib-([\\d.]+)\\.js', version: 1, confidence: 50 }],
    headers: { 'x-ver': [{ pattern: '([\\d.]+)', version: 1, confidence: 90 }] },
  })
  const out = detect({ url: 'u', scripts: ['lib-1.0.0.js'], headers: { 'x-ver': ['2.0.0'] } }, [f])
  expect(out[0]?.version).toBe('2.0.0')
})

test('equal confidence: first hit in source order wins', () => {
  const f = fp({
    html: [{ pattern: 'v=([\\d.]+)', version: 1 }],
    scripts: [{ pattern: 'lib-([\\d.]+)\\.js', version: 1 }],
  })
  const out = detect({ url: 'u', html: 'v=1.1', scripts: ['lib-9.9.js'] }, [f])
  expect(out[0]?.version).toBe('1.1')
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun test packages/core/test/version.test.ts`
Expected: FAIL (version always null).

- [ ] **Step 3: Implement**

In `toDetection`:

```ts
  let version: string | null = null
  let versionConf = -1
  for (const h of hits) {
    if (h.rule.version === undefined) continue
    const captured = h.captures[h.rule.version]
    if (!captured) continue
    const conf = h.rule.confidence ?? 100
    if (conf > versionConf) { version = captured; versionConf = conf }
  }
```

`collectHits` must push hits in source order html → scripts → headers → meta → cookies → js → dom; verify the code from Tasks 2-3 already does this and reorder the blocks if it does not.

- [ ] **Step 4: Run tests, verify pass**

Run: `bun test`
Expected: all pass.

- [ ] **Step 5: Commit**

```bash
git add -A && git commit -m "feat(core): version resolution by confidence then source order"
```

---

### Task 6: excludes, then implies

**Files:**
- Modify: `packages/core/src/detect.ts` (`detect`)
- Test: `packages/core/test/implies-excludes.test.ts`

**Interfaces:**
- Consumes: direct detections from Tasks 2-5.
- Produces: final resolution order — match all, apply `excludes` in fingerprint list order, then expand `implies` transitively (confidence × 0.9 per hop, `Math.round`), never adding an excluded or already-detected slug. Implied detections carry evidence `{ source: 'implied', pattern: 'implied-by: <slug>', match: '' }`.

- [ ] **Step 1: Write the failing test**

`packages/core/test/implies-excludes.test.ts`:

```ts
import { expect, test } from 'bun:test'
import { detect } from '../src/index'
import type { Fingerprint } from '../src/index'

const react: Fingerprint = {
  name: 'React', slug: 'react', category: 'js-framework', website: 'https://react.dev',
  detect: { html: [{ pattern: 'data-reactroot' }] },
}
const nextjs: Fingerprint = {
  name: 'Next.js', slug: 'nextjs', category: 'web-framework', website: 'https://nextjs.org',
  implies: ['react'],
  detect: { html: [{ pattern: '__NEXT_DATA__' }] },
}
const genericCms: Fingerprint = {
  name: 'GenericCMS', slug: 'generic-cms', category: 'cms', website: 'https://x.com',
  detect: { html: [{ pattern: 'cms' }] },
}
const wordpress: Fingerprint = {
  name: 'WordPress', slug: 'wordpress', category: 'cms', website: 'https://wordpress.org',
  excludes: ['generic-cms'], implies: ['generic-cms'],
  detect: { html: [{ pattern: 'wp-content' }] },
}

test('implies adds technology at 0.9 confidence with implied evidence', () => {
  const out = detect({ url: 'u', html: '__NEXT_DATA__' }, [react, nextjs])
  const r = out.find((d) => d.slug === 'react')
  expect(r?.confidence).toBe(90)
  expect(r?.evidence).toEqual([{ source: 'implied', pattern: 'implied-by: nextjs', match: '' }])
})

test('direct detection beats implication', () => {
  const out = detect({ url: 'u', html: '__NEXT_DATA__ data-reactroot' }, [react, nextjs])
  expect(out.find((d) => d.slug === 'react')?.confidence).toBe(100)
})

test('excludes removes a matched technology', () => {
  const out = detect({ url: 'u', html: 'cms wp-content' }, [genericCms, wordpress])
  expect(out.map((d) => d.slug)).toEqual(['wordpress'])
})

test('implies never resurrects an excluded slug', () => {
  const out = detect({ url: 'u', html: 'cms wp-content' }, [genericCms, wordpress])
  expect(out.find((d) => d.slug === 'generic-cms')).toBeUndefined()
})

test('transitive implies multiplies per hop', () => {
  const a: Fingerprint = { name: 'A', slug: 'a', category: 'cms', website: 'https://x.com', implies: ['b'], detect: { html: [{ pattern: 'aaa' }] } }
  const b: Fingerprint = { name: 'B', slug: 'b', category: 'cms', website: 'https://x.com', implies: ['c'], detect: {} }
  const c: Fingerprint = { name: 'C', slug: 'c', category: 'cms', website: 'https://x.com', detect: {} }
  const out = detect({ url: 'u', html: 'aaa' }, [a, b, c])
  expect(out.find((d) => d.slug === 'c')?.confidence).toBe(81)  // round(round(100*.9)*.9)
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun test packages/core/test/implies-excludes.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implement**

Rework the body of `detect`:

```ts
export function detect(
  bundle: SignalBundle, fingerprints: Fingerprint[], options: DetectOptions = {},
): Detection[] {
  const bySlug = new Map(fingerprints.map((f) => [f.slug, f]))
  const found = new Map<string, Detection>()
  for (const fp of fingerprints) {
    const hits = collectHits(fp, bundle, options)
    if (hits.length > 0) found.set(fp.slug, toDetection(fp, hits))
  }
  // excludes: fingerprint list order; mutual excludes resolve to the earlier one
  const excluded = new Set<string>()
  for (const fp of fingerprints) {
    if (!found.has(fp.slug) || excluded.has(fp.slug)) continue
    for (const ex of fp.excludes ?? []) { excluded.add(ex); found.delete(ex) }
  }
  // implies: BFS from every direct detection
  const queue = [...found.values()]
  while (queue.length > 0) {
    const parent = queue.shift()!
    const fp = bySlug.get(parent.slug)
    for (const slug of fp?.implies ?? []) {
      if (found.has(slug) || excluded.has(slug)) continue
      const target = bySlug.get(slug)
      if (!target) continue                      // compiler prevents this; be lenient at runtime
      const child: Detection = {
        slug: target.slug, name: target.name, category: target.category,
        confidence: Math.round(parent.confidence * 0.9),
        version: null,
        evidence: [{ source: 'implied', pattern: `implied-by: ${parent.slug}`, match: '' }],
      }
      found.set(slug, child)
      queue.push(child)
    }
  }
  const out = [...found.values()]
  out.sort((a, b) => b.confidence - a.confidence || a.slug.localeCompare(b.slug))
  return out
}
```

- [ ] **Step 4: Run tests, verify pass**

Run: `bun test`
Expected: all pass.

- [ ] **Step 5: Commit**

```bash
git add -A && git commit -m "feat(core): excludes then transitive implies resolution"
```

---

### Task 7: Broken-regex isolation

**Files:**
- Modify: `packages/core/src/match.ts`, `packages/core/src/detect.ts`
- Test: `packages/core/test/broken-regex.test.ts`

**Interfaces:**
- Consumes: `DetectOptions.onWarning` from Task 2 types.
- Produces: a rule whose pattern fails to compile is skipped; `onWarning` receives one message per broken rule; the scan always completes.

- [ ] **Step 1: Write the failing test**

`packages/core/test/broken-regex.test.ts`:

```ts
import { expect, test } from 'bun:test'
import { detect } from '../src/index'
import type { Fingerprint } from '../src/index'

const broken: Fingerprint = {
  name: 'Broken', slug: 'broken', category: 'cms', website: 'https://x.com',
  detect: { html: [{ pattern: '([' }, { pattern: 'works' }] },
}

test('broken pattern is skipped, other rules still run', () => {
  const warnings: string[] = []
  const out = detect({ url: 'u', html: 'works' }, [broken], { onWarning: (m) => warnings.push(m) })
  expect(out[0]?.slug).toBe('broken')
  expect(out[0]?.evidence).toHaveLength(1)
  expect(warnings).toHaveLength(1)
  expect(warnings[0]).toContain('([')
})

test('no onWarning provided: scan still completes silently', () => {
  expect(detect({ url: 'u', html: 'works' }, [broken])).toHaveLength(1)
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun test packages/core/test/broken-regex.test.ts`
Expected: FAIL (throws SyntaxError).

- [ ] **Step 3: Implement**

In `runRule`, wrap compile + exec:

```ts
export function runRule(
  rule: Rule, source: Source, text: string, key?: string,
  onWarning?: (message: string) => void,
): RuleHit | null {
  if (rule.pattern === '') { /* unchanged */ }
  let m: RegExpExecArray | null
  try {
    m = new RegExp(rule.pattern, 'i').exec(text)
  } catch (err) {
    onWarning?.(`invalid pattern ${JSON.stringify(rule.pattern)} (${source}): ${String(err)}`)
    return null
  }
  if (!m) return null
  /* unchanged */
}
```

Thread `options.onWarning` through every `runRule` call in `collectHits`.

- [ ] **Step 4: Run tests, verify pass**

Run: `bun test`
Expected: all pass.

- [ ] **Step 5: Commit**

```bash
git add -A && git commit -m "feat(core): isolate broken regex rules with warnings"
```

---

### Task 8: Fingerprint JSON Schema, categories, validator

**Files:**
- Create: `schemas/fingerprint.schema.json`, `schemas/categories.json`, `packages/fingerprints/package.json`, `packages/fingerprints/tsconfig.json`, `packages/fingerprints/src/validate.ts`
- Test: `packages/fingerprints/test/validate.test.ts`

**Interfaces:**
- Consumes: `Fingerprint` type shape from Task 2.
- Produces: `validateFingerprint(doc: unknown): string[]` — returns `[]` when valid, otherwise human-readable error strings. Categories list used by Task 9 and Task 12.

New dependencies (this package only, dev-time): `yaml`, `ajv`.

- [ ] **Step 1: Package + schema files**

`packages/fingerprints/package.json`:

```json
{
  "name": "@opentechcheck/fingerprints",
  "version": "0.0.1",
  "type": "module",
  "license": "Apache-2.0",
  "main": "dist/fingerprints.json",
  "scripts": { "compile": "bun run src/compile.ts" },
  "dependencies": {},
  "devDependencies": { "yaml": "^2.5.0", "ajv": "^8.17.0" }
}
```

`packages/fingerprints/tsconfig.json`:

```json
{ "extends": "../../tsconfig.base.json", "include": ["src", "test"] }
```

`schemas/categories.json`:

```json
[
  "js-framework", "web-framework", "js-library", "ui-framework",
  "cms", "ecommerce", "analytics", "tag-manager",
  "cdn", "hosting", "payment", "security",
  "marketing", "database", "server", "other"
]
```

`schemas/fingerprint.schema.json`:

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "type": "object",
  "required": ["name", "slug", "category", "website", "detect"],
  "additionalProperties": false,
  "properties": {
    "name": { "type": "string", "minLength": 1 },
    "slug": { "type": "string", "pattern": "^[a-z0-9][a-z0-9-]*$" },
    "category": { "type": "string" },
    "website": { "type": "string", "pattern": "^https?://" },
    "implies": { "type": "array", "items": { "type": "string" }, "default": [] },
    "excludes": { "type": "array", "items": { "type": "string" }, "default": [] },
    "detect": {
      "type": "object",
      "additionalProperties": false,
      "properties": {
        "html": { "$ref": "#/$defs/ruleList" },
        "scripts": { "$ref": "#/$defs/ruleList" },
        "headers": { "$ref": "#/$defs/keyedRules" },
        "meta": { "$ref": "#/$defs/keyedRules" },
        "cookies": { "$ref": "#/$defs/keyedRules" },
        "js": { "$ref": "#/$defs/keyedRules" },
        "dom": { "$ref": "#/$defs/keyedRules" }
      }
    }
  },
  "$defs": {
    "rule": {
      "type": "object",
      "required": ["pattern"],
      "additionalProperties": false,
      "properties": {
        "pattern": { "type": "string" },
        "version": { "type": "integer", "minimum": 1 },
        "confidence": { "type": "integer", "minimum": 0, "maximum": 100 }
      }
    },
    "ruleList": { "type": "array", "items": { "$ref": "#/$defs/rule" } },
    "keyedRules": {
      "type": "object",
      "additionalProperties": { "$ref": "#/$defs/ruleList" }
    }
  }
}
```

- [ ] **Step 2: Write the failing test**

`packages/fingerprints/test/validate.test.ts`:

```ts
import { expect, test } from 'bun:test'
import { validateFingerprint } from '../src/validate'

const valid = {
  name: 'WordPress', slug: 'wordpress', category: 'cms', website: 'https://wordpress.org',
  detect: { html: [{ pattern: 'wp-content' }] },
}

test('valid fingerprint -> no errors', () => {
  expect(validateFingerprint(valid)).toEqual([])
})

test('unknown category rejected', () => {
  expect(validateFingerprint({ ...valid, category: 'nope' })[0]).toContain('category')
})

test('uppercase header key rejected', () => {
  const doc = { ...valid, detect: { headers: { 'X-Powered-By': [{ pattern: 'x' }] } } }
  expect(validateFingerprint(doc)[0]).toContain('lowercase')
})

test('missing pattern rejected', () => {
  const doc = { ...valid, detect: { html: [{ confidence: 50 }] } }
  expect(validateFingerprint(doc).length).toBeGreaterThan(0)
})
```

- [ ] **Step 3: Run test to verify it fails**

Run: `bun install && bun test packages/fingerprints`
Expected: FAIL (module missing).

- [ ] **Step 4: Implement**

`packages/fingerprints/src/validate.ts`:

```ts
import { Ajv } from 'ajv'
import schema from '../../../schemas/fingerprint.schema.json'
import categories from '../../../schemas/categories.json'

const ajv = new Ajv({ allErrors: true })
const validateSchema = ajv.compile(schema)

export function validateFingerprint(doc: unknown): string[] {
  const errors: string[] = []
  if (!validateSchema(doc)) {
    for (const e of validateSchema.errors ?? []) errors.push(`${e.instancePath} ${e.message}`)
    return errors
  }
  const fp = doc as { category: string; detect: Record<string, unknown> }
  if (!categories.includes(fp.category)) {
    errors.push(`unknown category "${fp.category}" (see schemas/categories.json)`)
  }
  for (const source of ['headers', 'meta'] as const) {
    const table = fp.detect[source] as Record<string, unknown> | undefined
    for (const key of Object.keys(table ?? {})) {
      if (key !== key.toLowerCase()) errors.push(`${source} key "${key}" must be lowercase`)
    }
  }
  return errors
}
```

If `import ... from '*.json'` needs it, add `"resolveJsonModule": true` to `tsconfig.base.json`.

- [ ] **Step 5: Run tests, verify pass**

Run: `bun test`
Expected: all pass.

- [ ] **Step 6: Commit**

```bash
git add -A && git commit -m "feat(fingerprints): JSON schema, categories, validator"
```

---

### Task 9: Regex lint and compiler CLI

**Files:**
- Create: `packages/fingerprints/src/lint.ts`, `packages/fingerprints/src/compile.ts`
- Test: `packages/fingerprints/test/lint.test.ts`, `packages/fingerprints/test/compile.test.ts`

**Interfaces:**
- Consumes: `validateFingerprint` (Task 8), `Fingerprint` type (Task 2).
- Produces:
  - `lintPattern(pattern: string): string | null` — error message or null.
  - `compile(srcDir: string): { fingerprints: Fingerprint[]; errors: string[] }`
  - CLI: `bun run compile` (from `packages/fingerprints`) writes `dist/fingerprints.json`, exits 1 on any error.

- [ ] **Step 1: Write the failing lint test**

`packages/fingerprints/test/lint.test.ts`:

```ts
import { expect, test } from 'bun:test'
import { lintPattern } from '../src/lint'

test('accepts ordinary patterns', () => {
  expect(lintPattern('WordPress\\s([\\d.]+)')).toBeNull()
  expect(lintPattern('cdn\\.shopify\\.com')).toBeNull()
  expect(lintPattern('')).toBeNull()
})

test('rejects invalid regex', () => {
  expect(lintPattern('([')).toContain('invalid')
})

test('rejects nested quantifiers', () => {
  expect(lintPattern('(a+)+b')).toContain('nested quantifier')
  expect(lintPattern('(?:\\w*)*x')).toContain('nested quantifier')
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun test packages/fingerprints/test/lint.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implement lint**

`packages/fingerprints/src/lint.ts`:

```ts
// Quantified group that itself contains a quantifier: classic ReDoS shape.
const NESTED_QUANTIFIER = /\((?:[^()\\]|\\.)*(?<!\\)[+*](?:[^()\\]|\\.)*\)[+*]/

export function lintPattern(pattern: string): string | null {
  if (pattern === '') return null
  try {
    new RegExp(pattern, 'i')
  } catch (err) {
    return `invalid regex: ${String(err)}`
  }
  if (NESTED_QUANTIFIER.test(pattern)) {
    return 'nested quantifier (ReDoS risk): rewrite the pattern without a quantified group under a quantifier'
  }
  return null
}
```

Run: `bun test packages/fingerprints/test/lint.test.ts` — expected PASS. Commit:

```bash
git add -A && git commit -m "feat(fingerprints): regex lint against ReDoS shapes"
```

- [ ] **Step 4: Write the failing compile test**

`packages/fingerprints/test/compile.test.ts` (uses a temp dir):

```ts
import { expect, test } from 'bun:test'
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { compile } from '../src/compile'

function tempRegistry(files: Record<string, string>): string {
  const dir = mkdtempSync(join(tmpdir(), 'otc-'))
  for (const [rel, content] of Object.entries(files)) {
    const full = join(dir, rel)
    mkdirSync(join(full, '..'), { recursive: true })
    writeFileSync(full, content)
  }
  return dir
}

const WP = `name: WordPress
slug: wordpress
category: cms
website: https://wordpress.org
detect:
  html:
    - pattern: wp-content
`

test('compiles valid registry', () => {
  const dir = tempRegistry({ 'cms/wordpress.yaml': WP })
  const { fingerprints, errors } = compile(dir)
  expect(errors).toEqual([])
  expect(fingerprints[0]?.slug).toBe('wordpress')
})

test('slug must match filename', () => {
  const dir = tempRegistry({ 'cms/wrong.yaml': WP })
  expect(compile(dir).errors[0]).toContain('filename')
})

test('implies must reference known slug', () => {
  const dir = tempRegistry({ 'cms/wordpress.yaml': WP.replace('detect:', 'implies: [ghost-slug]\ndetect:') })
  expect(compile(dir).errors[0]).toContain('ghost-slug')
})

test('lint errors are reported with file path', () => {
  const dir = tempRegistry({ 'cms/wordpress.yaml': WP.replace('wp-content', "'(a+)+b'") })
  expect(compile(dir).errors[0]).toContain('wordpress.yaml')
})
```

Note: the compiler runs under Bun only, so `node:fs` is allowed here. The zero-Node rule applies to `core` and `collect-http`.

- [ ] **Step 5: Run test to verify it fails**

Run: `bun test packages/fingerprints/test/compile.test.ts`
Expected: FAIL.

- [ ] **Step 6: Implement compiler**

`packages/fingerprints/src/compile.ts`:

```ts
import { readdirSync, readFileSync, mkdirSync, writeFileSync } from 'node:fs'
import { join, basename } from 'node:path'
import { parse } from 'yaml'
import type { Fingerprint, Rule } from '@opentechcheck/core'
import { validateFingerprint } from './validate'
import { lintPattern } from './lint'

function* yamlFiles(dir: string): Generator<string> {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name)
    if (entry.isDirectory()) yield* yamlFiles(full)
    else if (entry.name.endsWith('.yaml')) yield full
  }
}

function* allRules(fp: Fingerprint): Generator<Rule> {
  const d = fp.detect
  for (const list of [d.html ?? [], d.scripts ?? []]) yield* list
  for (const table of [d.headers, d.meta, d.cookies, d.js, d.dom]) {
    for (const list of Object.values(table ?? {})) yield* list
  }
}

export function compile(srcDir: string): { fingerprints: Fingerprint[]; errors: string[] } {
  const fingerprints: Fingerprint[] = []
  const errors: string[] = []
  for (const file of yamlFiles(srcDir)) {
    let doc: unknown
    try {
      doc = parse(readFileSync(file, 'utf8'))
    } catch (err) {
      errors.push(`${file}: yaml parse error: ${String(err)}`)
      continue
    }
    const docErrors = validateFingerprint(doc)
    if (docErrors.length > 0) {
      errors.push(...docErrors.map((e) => `${file}: ${e}`))
      continue
    }
    const fp = doc as Fingerprint
    if (basename(file, '.yaml') !== fp.slug) {
      errors.push(`${file}: filename must equal slug "${fp.slug}"`)
    }
    for (const rule of allRules(fp)) {
      const lintError = lintPattern(rule.pattern)
      if (lintError) errors.push(`${file}: pattern ${JSON.stringify(rule.pattern)}: ${lintError}`)
    }
    fingerprints.push(fp)
  }
  const slugs = new Set(fingerprints.map((f) => f.slug))
  for (const fp of fingerprints) {
    for (const ref of [...(fp.implies ?? []), ...(fp.excludes ?? [])]) {
      if (!slugs.has(ref)) errors.push(`${fp.slug}: references unknown slug "${ref}"`)
    }
  }
  fingerprints.sort((a, b) => a.slug.localeCompare(b.slug))
  return { fingerprints, errors }
}

if (import.meta.main) {
  const srcDir = join(import.meta.dir, '..', 'src', 'registry')
  const { fingerprints, errors } = compile(srcDir)
  if (errors.length > 0) {
    for (const e of errors) console.error(e)
    process.exit(1)
  }
  const outDir = join(import.meta.dir, '..', 'dist')
  mkdirSync(outDir, { recursive: true })
  writeFileSync(join(outDir, 'fingerprints.json'), JSON.stringify(fingerprints, null, 2))
  console.log(`compiled ${fingerprints.length} fingerprints`)
}
```

Add core as a workspace dependency of fingerprints (`packages/fingerprints/package.json` → `"dependencies": { "@opentechcheck/core": "workspace:*" }`), then `bun install`. YAML sources live in `packages/fingerprints/src/registry/<category>/<slug>.yaml`; create the empty `src/registry/` directory now with a `.gitkeep`.

- [ ] **Step 7: Run tests, verify pass**

Run: `bun test`
Expected: all pass.

- [ ] **Step 8: Commit**

```bash
git add -A && git commit -m "feat(fingerprints): YAML compiler with cross-reference checks"
```

---

### Task 10: collect-http

**Files:**
- Create: `packages/collect-http/package.json`, `packages/collect-http/tsconfig.json`, `packages/collect-http/src/index.ts`, `packages/collect-http/src/extract.ts`
- Test: `packages/collect-http/test/extract.test.ts`, `packages/collect-http/test/collect.test.ts`

**Interfaces:**
- Consumes: `SignalBundle` type from Task 2.
- Produces:
  - `collect(url: string, options?: CollectOptions): Promise<CollectResult>`
  - `type CollectResult = { ok: true; bundle: SignalBundle } | { ok: false; error: { code: 'fetch_failed' | 'timeout' | 'http_error' | 'non_html'; message: string } }`
  - `interface CollectOptions { timeoutMs?: number; fetch?: typeof fetch }` (default timeout 10000; injectable fetch for tests)
  - `extractSignals(url: string, html: string, headers: Headers): SignalBundle` (exported for the extension and tests)

- [ ] **Step 1: Package skeleton**

`packages/collect-http/package.json`:

```json
{
  "name": "@opentechcheck/collect-http",
  "version": "0.0.1",
  "type": "module",
  "license": "Apache-2.0",
  "main": "src/index.ts",
  "exports": { ".": "./src/index.ts" },
  "dependencies": { "@opentechcheck/core": "workspace:*" }
}
```

`packages/collect-http/tsconfig.json`: same one-liner as the other packages.

- [ ] **Step 2: Write the failing extract test**

`packages/collect-http/test/extract.test.ts`:

```ts
import { expect, test } from 'bun:test'
import { extractSignals } from '../src/extract'

const HTML = `<!doctype html><html><head>
<meta name="generator" content="WordPress 6.5" />
<meta property="og:site_name" content="Example" />
<script src="/wp-includes/js/jquery.js"></script>
<script src='https://cdn.shopify.com/x.js'></script>
</head><body></body></html>`

test('extracts script srcs', () => {
  const b = extractSignals('https://a.com', HTML, new Headers())
  expect(b.scripts).toEqual(['/wp-includes/js/jquery.js', 'https://cdn.shopify.com/x.js'])
})

test('extracts meta by lowercase name and property', () => {
  const b = extractSignals('https://a.com', HTML, new Headers())
  expect(b.meta?.['generator']).toEqual(['WordPress 6.5'])
  expect(b.meta?.['og:site_name']).toEqual(['Example'])
})

test('lowercases header names and splits set-cookie into cookies', () => {
  const h = new Headers()
  h.append('Server', 'cloudflare')
  h.append('Set-Cookie', '_shopify_s=abc; Path=/; HttpOnly')
  const b = extractSignals('https://a.com', '<html></html>', h)
  expect(b.headers?.['server']).toEqual(['cloudflare'])
  expect(b.cookies?.['_shopify_s']).toBe('abc')
})

test('keeps raw html', () => {
  const b = extractSignals('https://a.com', HTML, new Headers())
  expect(b.html).toContain('WordPress 6.5')
})
```

- [ ] **Step 3: Run test to verify it fails**

Run: `bun test packages/collect-http`
Expected: FAIL.

- [ ] **Step 4: Implement extract**

`packages/collect-http/src/extract.ts`:

```ts
import type { SignalBundle } from '@opentechcheck/core'

const SCRIPT_SRC = /<script\b[^>]*?\bsrc\s*=\s*["']([^"']+)["']/gi
const META_TAG = /<meta\b[^>]*>/gi
const ATTR = (name: string) => new RegExp(`\\b${name}\\s*=\\s*["']([^"']*)["']`, 'i')

export function extractSignals(url: string, html: string, headers: Headers): SignalBundle {
  const scripts = Array.from(html.matchAll(SCRIPT_SRC), (m) => m[1] ?? '')

  const meta: Record<string, string[]> = {}
  for (const m of html.matchAll(META_TAG)) {
    const tag = m[0]
    const name = ATTR('name').exec(tag)?.[1] ?? ATTR('property').exec(tag)?.[1]
    const content = ATTR('content').exec(tag)?.[1]
    if (!name || content === undefined) continue
    const key = name.toLowerCase()
    ;(meta[key] ??= []).push(content)
  }

  const headerTable: Record<string, string[]> = {}
  const cookies: Record<string, string> = {}
  headers.forEach((value, key) => {
    const k = key.toLowerCase()
    ;(headerTable[k] ??= []).push(value)
    if (k === 'set-cookie') {
      const [pair] = value.split(';')
      const eq = pair?.indexOf('=') ?? -1
      if (pair && eq > 0) cookies[pair.slice(0, eq).trim()] = pair.slice(eq + 1).trim()
    }
  })

  return { url, html, scripts, meta, headers: headerTable, cookies }
}
```

Run the extract test — expected PASS. Commit:

```bash
git add -A && git commit -m "feat(collect-http): signal extraction from html and headers"
```

- [ ] **Step 5: Write the failing collect test**

`packages/collect-http/test/collect.test.ts`:

```ts
import { expect, test } from 'bun:test'
import { collect } from '../src/index'

const okFetch = (body: string, init: ResponseInit = {}) =>
  (async () => new Response(body, { headers: { 'content-type': 'text/html' }, ...init })) as unknown as typeof fetch

test('happy path returns bundle with final url', async () => {
  const r = await collect('https://a.com', { fetch: okFetch('<html>x</html>') })
  expect(r.ok).toBe(true)
  if (r.ok) expect(r.bundle.html).toContain('x')
})

test('non-html content type -> non_html error', async () => {
  const f = (async () => new Response('{}', { headers: { 'content-type': 'application/json' } })) as unknown as typeof fetch
  const r = await collect('https://a.com', { fetch: f })
  expect(r).toMatchObject({ ok: false, error: { code: 'non_html' } })
})

test('http error status -> http_error', async () => {
  const r = await collect('https://a.com', { fetch: okFetch('nope', { status: 500 }) })
  expect(r).toMatchObject({ ok: false, error: { code: 'http_error' } })
})

test('network failure -> fetch_failed', async () => {
  const f = (async () => { throw new TypeError('boom') }) as unknown as typeof fetch
  const r = await collect('https://a.com', { fetch: f })
  expect(r).toMatchObject({ ok: false, error: { code: 'fetch_failed' } })
})

test('timeout -> timeout error', async () => {
  const f = ((_url: unknown, init?: RequestInit) =>
    new Promise((_resolve, reject) => {
      init?.signal?.addEventListener('abort', () => reject(new DOMException('aborted', 'AbortError')))
    })) as unknown as typeof fetch
  const r = await collect('https://a.com', { fetch: f, timeoutMs: 20 })
  expect(r).toMatchObject({ ok: false, error: { code: 'timeout' } })
})
```

- [ ] **Step 6: Run test to verify it fails**

Run: `bun test packages/collect-http/test/collect.test.ts`
Expected: FAIL.

- [ ] **Step 7: Implement collect**

`packages/collect-http/src/index.ts`:

```ts
import { extractSignals } from './extract'
import type { SignalBundle } from '@opentechcheck/core'

export { extractSignals }

export type CollectErrorCode = 'fetch_failed' | 'timeout' | 'http_error' | 'non_html'

export type CollectResult =
  | { ok: true; bundle: SignalBundle }
  | { ok: false; error: { code: CollectErrorCode; message: string } }

export interface CollectOptions {
  timeoutMs?: number
  fetch?: typeof fetch
}

export async function collect(url: string, options: CollectOptions = {}): Promise<CollectResult> {
  const timeoutMs = options.timeoutMs ?? 10_000
  const doFetch = options.fetch ?? fetch
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  try {
    const res = await doFetch(url, { redirect: 'follow', signal: controller.signal })
    if (!res.ok) {
      return { ok: false, error: { code: 'http_error', message: `HTTP ${res.status}` } }
    }
    const type = res.headers.get('content-type') ?? ''
    if (!type.includes('text/html')) {
      return { ok: false, error: { code: 'non_html', message: `content-type: ${type || 'none'}` } }
    }
    const html = await res.text()
    return { ok: true, bundle: extractSignals(res.url || url, html, res.headers) }
  } catch (err) {
    const code: CollectErrorCode =
      err instanceof DOMException && err.name === 'AbortError' ? 'timeout' : 'fetch_failed'
    return { ok: false, error: { code, message: String(err) } }
  } finally {
    clearTimeout(timer)
  }
}
```

- [ ] **Step 8: Run tests, verify pass**

Run: `bun test`
Expected: all pass.

- [ ] **Step 9: Commit**

```bash
git add -A && git commit -m "feat(collect-http): fetch collector with typed errors"
```

---

### Task 11: Fixture harness and capture script

**Files:**
- Create: `packages/fingerprints/test/fixtures.test.ts`, `scripts/capture.ts`, `fixtures/.gitkeep`
- Modify: root `package.json` (add `capture` and `compile` scripts)

**Interfaces:**
- Consumes: `compile` (Task 9), `detect` (core), `collect` (Task 10).
- Produces:
  - Fixture layout: `fixtures/<slug>/<name>.bundle.json` (a `SignalBundle`) + `fixtures/<slug>/<name>.expected.json` (`{ "detects": ["slug", ...] }` — the exact set of slugs the bundle must produce).
  - `bun run capture <url> <slug> [name]` writes both files.
  - Harness rules: every fixture must detect exactly its expected set (extra detections fail — false-positive regression); every fingerprint in the registry must own at least one fixture directory.

- [ ] **Step 1: Write the failing harness test**

`packages/fingerprints/test/fixtures.test.ts`:

```ts
import { expect, test, describe } from 'bun:test'
import { readdirSync, readFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import { detect, type SignalBundle } from '@opentechcheck/core'
import { compile } from '../src/compile'

const REGISTRY = join(import.meta.dir, '..', 'src', 'registry')
const FIXTURES = join(import.meta.dir, '..', '..', '..', 'fixtures')

const { fingerprints, errors } = compile(REGISTRY)

test('registry compiles clean', () => {
  expect(errors).toEqual([])
})

const slugDirs = existsSync(FIXTURES)
  ? readdirSync(FIXTURES, { withFileTypes: true }).filter((e) => e.isDirectory()).map((e) => e.name)
  : []

test('every fingerprint has at least one fixture', () => {
  const missing = fingerprints.map((f) => f.slug).filter((s) => !slugDirs.includes(s))
  expect(missing).toEqual([])
})

for (const slug of slugDirs) {
  describe(`fixtures/${slug}`, () => {
    const dir = join(FIXTURES, slug)
    const bundles = readdirSync(dir).filter((f) => f.endsWith('.bundle.json'))
    test('has at least one bundle', () => expect(bundles.length).toBeGreaterThan(0))
    for (const file of bundles) {
      test(file, () => {
        const bundle = JSON.parse(readFileSync(join(dir, file), 'utf8')) as SignalBundle
        const expectedPath = join(dir, file.replace('.bundle.json', '.expected.json'))
        const { detects } = JSON.parse(readFileSync(expectedPath, 'utf8')) as { detects: string[] }
        const got = detect(bundle, fingerprints).map((d) => d.slug).sort()
        expect(got).toEqual([...detects].sort())
      })
    }
  })
}
```

- [ ] **Step 2: Run test to verify current state**

Run: `bun test packages/fingerprints/test/fixtures.test.ts`
Expected: passes trivially while registry and fixtures are both empty (`registry compiles clean`, missing list `[]`). This harness does its work from Task 12 on. Verify it runs without crashing.

- [ ] **Step 3: Capture script**

`scripts/capture.ts`:

```ts
import { mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { collect } from '@opentechcheck/collect-http'

const [url, slug, name] = process.argv.slice(2)
if (!url || !slug) {
  console.error('usage: bun run capture <url> <slug> [fixture-name]')
  process.exit(1)
}
const result = await collect(url)
if (!result.ok) {
  console.error(`${result.error.code}: ${result.error.message}`)
  process.exit(1)
}
const fixtureName = name ?? new URL(result.bundle.url).hostname.replace(/\./g, '-')
const dir = join(import.meta.dir, '..', 'fixtures', slug)
mkdirSync(dir, { recursive: true })
writeFileSync(join(dir, `${fixtureName}.bundle.json`), JSON.stringify(result.bundle, null, 2))
const expectedPath = join(dir, `${fixtureName}.expected.json`)
writeFileSync(expectedPath, JSON.stringify({ detects: [slug] }, null, 2))
console.log(`wrote fixtures/${slug}/${fixtureName}.bundle.json`)
console.log(`edit ${expectedPath} to list every slug this bundle should detect`)
```

Root `package.json` scripts additions:

```json
    "capture": "bun run scripts/capture.ts",
    "compile": "cd packages/fingerprints && bun run compile"
```

- [ ] **Step 4: Verify script wiring**

Run: `bun run capture`
Expected: usage line, exit 1.

- [ ] **Step 5: Commit**

```bash
git add -A && git commit -m "feat: fixture harness and capture script"
```

---

### Task 12: First 10 fingerprints with fixtures

**Files:**
- Create (in `packages/fingerprints/src/registry/`): `js-framework/react.yaml`, `web-framework/nextjs.yaml`, `js-framework/vue.yaml`, `web-framework/nuxt.yaml`, `cms/wordpress.yaml`, `ecommerce/woocommerce.yaml`, `ecommerce/shopify.yaml`, `cdn/cloudflare.yaml`, `analytics/google-analytics.yaml`, `js-library/jquery.yaml`
- Create: one fixture pair per slug under `fixtures/<slug>/`

**Interfaces:**
- Consumes: everything.
- Produces: the shipped registry. Later coverage work copies this task's loop.

Per-technology loop (repeat for each YAML below):

- [ ] Write the YAML file.
- [ ] Run `bun run compile` — expect clean.
- [ ] Capture a fixture from a live site known to use the technology: `bun run capture <url> <slug>`. Suggested sites: react → `https://react.dev`, nextjs → `https://nextjs.org`, vue → `https://vuejs.org`, nuxt → `https://nuxt.com`, wordpress → `https://wordpress.org`, woocommerce → `https://woocommerce.com`, shopify → `https://www.allbirds.com`, cloudflare → `https://www.cloudflare.com`, google-analytics → any WordPress marketing site from the list, jquery → `https://wordpress.org` (bundled). If a capture fails (bot protection), pick another known user of the technology; record the choice in the commit message.
- [ ] Edit the `.expected.json` to list every slug the bundle legitimately contains (run `bun test` and reconcile: every unexpected detection is either a true co-detection — add it — or a false positive — fix the pattern).
- [ ] Run `bun test` — green.
- [ ] Commit: `git add -A && git commit -m "feat(registry): add <slug>"`

The 10 YAML files:

`js-framework/react.yaml`:

```yaml
name: React
slug: react
category: js-framework
website: https://react.dev
detect:
  html:
    - pattern: 'data-reactroot'
    - pattern: '\breact(?:\.production)?(?:\.min)?\.js'
      confidence: 70
  js:
    React.version:
      - pattern: '^([\d.]+)'
        version: 1
  dom:
    '[data-reactroot]':
      - pattern: ''
```

`web-framework/nextjs.yaml`:

```yaml
name: Next.js
slug: nextjs
category: web-framework
website: https://nextjs.org
implies: [react]
detect:
  html:
    - pattern: '__NEXT_DATA__'
    - pattern: 'id="__next"'
      confidence: 60
  scripts:
    - pattern: '/_next/static/'
  headers:
    x-powered-by:
      - pattern: 'Next\.js(?:\s([\d.]+))?'
        version: 1
```

`js-framework/vue.yaml`:

```yaml
name: Vue
slug: vue
category: js-framework
website: https://vuejs.org
detect:
  html:
    - pattern: '\bdata-v-[0-9a-f]{7,8}\b'
  js:
    Vue.version:
      - pattern: '^([\d.]+)'
        version: 1
```

`web-framework/nuxt.yaml`:

```yaml
name: Nuxt
slug: nuxt
category: web-framework
website: https://nuxt.com
implies: [vue]
detect:
  html:
    - pattern: '__NUXT__'
    - pattern: 'id="__nuxt"'
  scripts:
    - pattern: '/_nuxt/'
```

`cms/wordpress.yaml`:

```yaml
name: WordPress
slug: wordpress
category: cms
website: https://wordpress.org
detect:
  html:
    - pattern: '/wp-content/'
    - pattern: '/wp-includes/'
  meta:
    generator:
      - pattern: 'WordPress(?:\s([\d.]+))?'
        version: 1
  scripts:
    - pattern: '/wp-includes/'
```

`ecommerce/woocommerce.yaml`:

```yaml
name: WooCommerce
slug: woocommerce
category: ecommerce
website: https://woocommerce.com
implies: [wordpress]
detect:
  html:
    - pattern: 'class="[^"]*woocommerce[^"]*"'
  meta:
    generator:
      - pattern: 'WooCommerce\s([\d.]+)'
        version: 1
  scripts:
    - pattern: '/plugins/woocommerce/'
```

`ecommerce/shopify.yaml`:

```yaml
name: Shopify
slug: shopify
category: ecommerce
website: https://www.shopify.com
detect:
  html:
    - pattern: 'Shopify\.theme'
    - pattern: 'cdn\.shopify\.com'
  scripts:
    - pattern: 'cdn\.shopify\.com'
  headers:
    x-shopify-stage:
      - pattern: ''
  cookies:
    _shopify_s:
      - pattern: ''
```

`cdn/cloudflare.yaml`:

```yaml
name: Cloudflare
slug: cloudflare
category: cdn
website: https://www.cloudflare.com
detect:
  headers:
    server:
      - pattern: '^cloudflare$'
    cf-ray:
      - pattern: ''
```

`analytics/google-analytics.yaml`:

```yaml
name: Google Analytics
slug: google-analytics
category: analytics
website: https://marketingplatform.google.com/about/analytics/
detect:
  html:
    - pattern: "gtag\\('config'"
      confidence: 80
  scripts:
    - pattern: 'googletagmanager\.com/gtag/js'
    - pattern: 'google-analytics\.com/analytics\.js'
```

`js-library/jquery.yaml`:

```yaml
name: jQuery
slug: jquery
category: js-library
website: https://jquery.com
detect:
  scripts:
    - pattern: 'jquery[/.-]([\d.]+)[^/]*\.js'
      version: 1
    - pattern: 'jquery(?:\.min)?\.js'
      confidence: 80
  js:
    jQuery.fn.jquery:
      - pattern: '^([\d.]+)'
        version: 1
```

- [ ] **Final step: full suite green, then commit any remaining fixture edits**

Run: `bun test && bun run compile && bunx tsc --noEmit -p packages/core`
Expected: all pass, `compiled 10 fingerprints`.

---

### Task 13: CI, README, CONTRIBUTING

**Files:**
- Create: `.github/workflows/ci.yml`, `README.md`, `CONTRIBUTING.md`

**Interfaces:**
- Consumes: root scripts from Tasks 1 and 11.
- Produces: PR gate; the contribution loop later coverage work follows.

- [ ] **Step 1: CI workflow**

`.github/workflows/ci.yml`:

```yaml
name: ci
on:
  push:
    branches: [main]
  pull_request:
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: oven-sh/setup-bun@v2
      - run: bun install --frozen-lockfile
      - run: bun run compile
      - run: bun run typecheck
      - run: bun test
```

- [ ] **Step 2: README**

`README.md` content:

```markdown
# OpenTechCheck

> See what websites are built with. Open-source technology fingerprinting for the web.

Detects the technologies behind a website — frameworks, CMS, analytics, CDN, and more —
with confidence scores and the evidence for every detection.

## Packages

| Package | Purpose |
|---|---|
| `@opentechcheck/core` | Pure detection engine: `detect(bundle, fingerprints)` |
| `@opentechcheck/fingerprints` | Community fingerprint registry (YAML → compiled JSON) |
| `@opentechcheck/collect-http` | Fetch-based signal collector |

## Quick start

```ts
import { detect } from '@opentechcheck/core'
import { collect } from '@opentechcheck/collect-http'
import fingerprints from '@opentechcheck/fingerprints'

const result = await collect('https://example.com')
if (result.ok) console.log(detect(result.bundle, fingerprints))
```

## Development

```bash
bun install
bun test
bun run compile   # validate + build the fingerprint registry
```

## Contributing

Add a technology in one YAML file plus one fixture — see [CONTRIBUTING.md](CONTRIBUTING.md).

## License

Apache-2.0
```

(The `main` of `@opentechcheck/fingerprints` is the compiled JSON, so the default import shown works once Task 9's compile has run; npm publishing wiring is out of scope for this plan.)

- [ ] **Step 3: CONTRIBUTING**

`CONTRIBUTING.md` content:

```markdown
# Contributing a fingerprint

1. Create `packages/fingerprints/src/registry/<category>/<slug>.yaml`.
   Categories: see `schemas/categories.json`. Schema: `schemas/fingerprint.schema.json`.
2. Capture a fixture from a site that uses the technology:
   `bun run capture <url> <slug>`
3. Edit `fixtures/<slug>/<name>.expected.json` so `detects` lists every
   technology that bundle contains.
4. `bun test` — every fingerprint runs against every fixture; unexpected
   detections are false positives and fail the build.
5. Open a pull request. CI runs schema validation, regex lint, compile,
   and the full suite.

Rules:
- One technology per file; filename equals `slug`.
- Header and meta keys lowercase.
- Prefer high-precision patterns; a fingerprint that matches unrelated
  sites will be rejected by the fixture suite.
- Version captures use `version: <group index>`.
```

- [ ] **Step 4: Verify and commit**

Run: `bun test`
Expected: green.

```bash
git add -A && git commit -m "chore: CI workflow, README, contributing guide"
git push
```

Confirm the GitHub Actions run passes on the pushed commit.
