# Browser Extension Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A Chrome + Firefox MV3 extension that detects a page's technologies fully locally, using `@opentechcheck/core` and the compiled fingerprint registry.

**Architecture:** Background-centric. A content script (ISOLATED) and a MAIN-world script collect page signals; the background worker adds headers (webRequest) and cookies, runs `detect()`, caches per tab in `storage.session`, and sets the badge. The popup (Svelte) is a pure renderer over messaging.

**Tech Stack:** TypeScript, Bun (tests, orchestration), Vite + @sveltejs/vite-plugin-svelte (bundling), Svelte 5 + Tailwind 4 (popup), happy-dom (DOM unit tests), puppeteer (e2e smoke).

**Spec:** `docs/superpowers/specs/2026-08-22-browser-extension-design.md`

## Global Constraints

- Package: `packages/extension`, name `@opentechcheck/extension`, workspace member.
- No network requests leave the browser at runtime; registry bundled at build time; no telemetry.
- Version floors: Chrome ≥ 121, Firefox ≥ 121 (MV3 `storage.session`, `world: "MAIN"` content scripts, webRequest-wakes-service-worker).
- Permissions exactly: `host_permissions: ["<all_urls>"]`, `permissions: ["webRequest", "cookies", "storage", "webNavigation", "tabs"]`. Nothing else; no `scripting`, no `downloads`.
- Grades: A ≥ 90, B ≥ 75, C ≥ 60, D below. Never render a percentage.
- Caps: html serialized max 500 000 chars; max 500 script URLs; MAIN-world values stringified to max 200 chars.
- All work on branch `feat/browser-extension`. Commit messages: conventional (`feat(extension): ...`), no co-author trailers, no Claude references.
- Run tests from `packages/extension` with `bun test` unless a step says otherwise.
- Existing suites (`bun test` at repo root) must stay green; do not modify core/fingerprints/collect-http except where a task says so.

## File Structure

```
packages/extension/
  package.json  tsconfig.json  vite.config.ts
  manifest/base.json  manifest/chrome.json  manifest/firefox.json
  build/build.ts            # orchestrates vite builds + manifest merge + list generation
  build/manifest.ts         # mergeManifest(base, overlay) — pure
  build/generate-lists.ts   # jsPaths(fps), domSelectors(fps) — pure
  src/shared/protocol.ts    # message + payload types shared by all contexts
  src/shared/ext.ts         # chrome/browser namespace shim
  src/content/collect.ts    # collectSignals(document, caps) — pure
  src/content/index.ts      # wiring: run, MAIN-world bridge, recollect listener
  src/main-world/read-globals.ts  # readGlobals(root, paths, cap) — pure
  src/main-world/index.ts   # wiring: read + postMessage
  src/background/store.ts   # session-storage helpers for headers/results
  src/background/assemble.ts# toBundle(...), toHeaderTable(...), toCookieRecord(...) — pure
  src/background/index.ts   # listeners, detect, badge, message router
  src/popup/format.ts       # grade(), groupByCategory(), stackSummary(), exportPayload() — pure
  src/popup/App.svelte  src/popup/main.ts  src/popup/popup.html  src/popup/app.css
  test/*.test.ts            # unit tests per module
  e2e/fixture/index.html  e2e/smoke.test.ts
```

---

### Task 1: Package scaffold + manifest merge

**Files:**
- Create: `packages/extension/package.json`, `packages/extension/tsconfig.json`, `packages/extension/manifest/base.json`, `packages/extension/manifest/chrome.json`, `packages/extension/manifest/firefox.json`, `packages/extension/build/manifest.ts`
- Test: `packages/extension/test/manifest.test.ts`
- Modify: root `package.json` (typecheck script gains `-p packages/extension`)

**Interfaces:**
- Produces: `mergeManifest(base: object, overlay: object): object` — deep merge; overlay wins on scalar conflict; arrays are replaced, never concatenated. Manifest JSON files with the exact permission set from Global Constraints.

- [ ] **Step 1: Scaffold package files**

`packages/extension/package.json`:
```json
{
  "name": "@opentechcheck/extension",
  "private": true,
  "type": "module",
  "scripts": {
    "build": "bun run build/build.ts",
    "test": "bun test"
  },
  "dependencies": {
    "@opentechcheck/core": "workspace:*",
    "@opentechcheck/fingerprints": "workspace:*"
  },
  "devDependencies": {
    "@sveltejs/vite-plugin-svelte": "^5.0.0",
    "@tailwindcss/vite": "^4.0.0",
    "happy-dom": "^15.0.0",
    "puppeteer": "^23.0.0",
    "svelte": "^5.0.0",
    "tailwindcss": "^4.0.0",
    "vite": "^6.0.0"
  }
}
```

`packages/extension/tsconfig.json`:
```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": { "types": ["bun-types", "chrome"] },
  "include": ["src", "build", "test"]
}
```
If `tsconfig.base.json` conflicts with `types`, add `@types/chrome` to devDependencies and keep the include list; adjust only within this package.

`packages/extension/manifest/base.json`:
```json
{
  "manifest_version": 3,
  "name": "OpenTechCheck",
  "version": "0.1.0",
  "description": "Detect the technologies a page uses. Fully local, no data leaves your browser.",
  "permissions": ["webRequest", "cookies", "storage", "webNavigation", "tabs"],
  "host_permissions": ["<all_urls>"],
  "action": { "default_popup": "popup.html", "default_title": "OpenTechCheck" },
  "content_scripts": [
    { "matches": ["http://*/*", "https://*/*"], "js": ["content.js"], "run_at": "document_idle" },
    { "matches": ["http://*/*", "https://*/*"], "js": ["main-world.js"], "run_at": "document_idle", "world": "MAIN" }
  ]
}
```

`packages/extension/manifest/chrome.json`:
```json
{ "background": { "service_worker": "background.js" }, "minimum_chrome_version": "121" }
```

`packages/extension/manifest/firefox.json`:
```json
{
  "background": { "scripts": ["background.js"] },
  "browser_specific_settings": { "gecko": { "id": "extension@opentechcheck.org", "strict_min_version": "121.0" } }
}
```

- [ ] **Step 2: Write the failing test**

`packages/extension/test/manifest.test.ts`:
```ts
import { expect, test } from 'bun:test'
import { mergeManifest } from '../build/manifest'
import base from '../manifest/base.json'
import chrome from '../manifest/chrome.json'
import firefox from '../manifest/firefox.json'

test('overlay scalar wins, base keys survive', () => {
  const out = mergeManifest({ a: 1, nest: { x: 1, y: 2 } }, { nest: { y: 3 } }) as any
  expect(out.a).toBe(1)
  expect(out.nest).toEqual({ x: 1, y: 3 })
})

test('arrays replace, never concat', () => {
  const out = mergeManifest({ list: [1, 2] }, { list: [3] }) as any
  expect(out.list).toEqual([3])
})

test('chrome manifest gets service worker, firefox gets event page', () => {
  const c = mergeManifest(base, chrome) as any
  const f = mergeManifest(base, firefox) as any
  expect(c.background.service_worker).toBe('background.js')
  expect(f.background.scripts).toEqual(['background.js'])
  expect(c.permissions).toEqual(['webRequest', 'cookies', 'storage', 'webNavigation', 'tabs'])
})
```

- [ ] **Step 3: Run test to verify it fails**

Run: `cd packages/extension && bun test test/manifest.test.ts`
Expected: FAIL — cannot resolve `../build/manifest`.

- [ ] **Step 4: Implement**

`packages/extension/build/manifest.ts`:
```ts
type Json = Record<string, unknown>

export function mergeManifest(base: Json, overlay: Json): Json {
  const out: Json = { ...base }
  for (const [key, value] of Object.entries(overlay)) {
    const prev = out[key]
    if (
      value !== null && typeof value === 'object' && !Array.isArray(value) &&
      prev !== null && typeof prev === 'object' && !Array.isArray(prev)
    ) {
      out[key] = mergeManifest(prev as Json, value as Json)
    } else {
      out[key] = value
    }
  }
  return out
}
```

- [ ] **Step 5: Run tests, verify pass**

Run: `cd packages/extension && bun install && bun test test/manifest.test.ts`
Expected: PASS. (`bun install` links workspace deps and pulls the new devDependencies.)

- [ ] **Step 6: Wire root typecheck and verify**

In root `package.json`, append `&& bunx tsc --noEmit -p packages/extension` to the `typecheck` script. Run from repo root: `bun run typecheck`. Expected: clean. If `@types/chrome` is missing, add it to this package's devDependencies and re-run.

- [ ] **Step 7: Commit**

```bash
git add packages/extension package.json bun.lock
git commit -m "feat(extension): scaffold package with manifest merge"
```

---

### Task 2: Build-time lists from the registry

**Files:**
- Create: `packages/extension/build/generate-lists.ts`
- Test: `packages/extension/test/generate-lists.test.ts`

**Interfaces:**
- Consumes: `Fingerprint[]` from `@opentechcheck/fingerprints` (JSON array; each item has optional `detect.js` / `detect.dom` keyed-rule objects).
- Produces: `jsPaths(fps: Fingerprint[]): string[]` — sorted unique dotted global paths from every `detect.js` key. `domSelectors(fps: Fingerprint[]): string[]` — sorted unique CSS selectors from every `detect.dom` key.

- [ ] **Step 1: Write the failing test**

`packages/extension/test/generate-lists.test.ts`:
```ts
import { expect, test } from 'bun:test'
import { jsPaths, domSelectors } from '../build/generate-lists'
import type { Fingerprint } from '@opentechcheck/core'
import registry from '@opentechcheck/fingerprints'

const fps: Fingerprint[] = [
  { name: 'A', slug: 'a', category: 'other', website: 'https://a.dev',
    detect: { js: { 'React.version': [{ pattern: '' }], jQuery: [{ pattern: '' }] } } },
  { name: 'B', slug: 'b', category: 'other', website: 'https://b.dev',
    detect: { js: { jQuery: [{ pattern: '' }] }, dom: { '#__next': [{ pattern: '' }] } } },
]

test('collects sorted unique js paths', () => {
  expect(jsPaths(fps)).toEqual(['React.version', 'jQuery'].sort())
})

test('collects sorted unique dom selectors', () => {
  expect(domSelectors(fps)).toEqual(['#__next'])
})

test('runs over the real registry without throwing', () => {
  expect(Array.isArray(jsPaths(registry as Fingerprint[]))).toBe(true)
  expect(Array.isArray(domSelectors(registry as Fingerprint[]))).toBe(true)
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd packages/extension && bun test test/generate-lists.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

`packages/extension/build/generate-lists.ts`:
```ts
import type { Fingerprint } from '@opentechcheck/core'

function keysOf(fps: Fingerprint[], source: 'js' | 'dom'): string[] {
  const keys = new Set<string>()
  for (const fp of fps) {
    for (const key of Object.keys(fp.detect[source] ?? {})) keys.add(key)
  }
  return [...keys].sort()
}

export const jsPaths = (fps: Fingerprint[]) => keysOf(fps, 'js')
export const domSelectors = (fps: Fingerprint[]) => keysOf(fps, 'dom')
```

- [ ] **Step 4: Run tests, verify pass**

Run: `cd packages/extension && bun test test/generate-lists.test.ts` — PASS.
If the registry JSON import fails to type as `Fingerprint[]`, cast via `as unknown as Fingerprint[]` in the test only.

- [ ] **Step 5: Commit**

```bash
git add packages/extension/build/generate-lists.ts packages/extension/test/generate-lists.test.ts
git commit -m "feat(extension): generate js and dom allowlists from registry"
```

---

### Task 3: Shared protocol + namespace shim

**Files:**
- Create: `packages/extension/src/shared/protocol.ts`, `packages/extension/src/shared/ext.ts`
- Test: `packages/extension/test/ext.test.ts`

**Interfaces:**
- Produces (consumed by every later task):

```ts
// protocol.ts — exact contents
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
```

- `ext.ts`: `export const ext: typeof chrome` — resolves the global `browser` namespace when present (Firefox), else `chrome`.

- [ ] **Step 1: Write protocol.ts exactly as above and the failing shim test**

`packages/extension/test/ext.test.ts`:
```ts
import { expect, test } from 'bun:test'

test('ext resolves browser over chrome', async () => {
  ;(globalThis as any).browser = { runtime: { id: 'ff' } }
  ;(globalThis as any).chrome = { runtime: { id: 'cr' } }
  const { resolveExt } = await import('../src/shared/ext')
  expect((resolveExt() as any).runtime.id).toBe('ff')
  delete (globalThis as any).browser
  expect((resolveExt() as any).runtime.id).toBe('cr')
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd packages/extension && bun test test/ext.test.ts` — FAIL, module not found.

- [ ] **Step 3: Implement**

`packages/extension/src/shared/ext.ts`:
```ts
export function resolveExt(): typeof chrome {
  const g = globalThis as Record<string, unknown>
  return (g.browser ?? g.chrome) as typeof chrome
}
export const ext: typeof chrome = resolveExt()
```
Note for later tasks: import `resolveExt` in code that unit tests exercise (so tests can stub globals), and the `ext` constant in pure wiring files.

- [ ] **Step 4: Run tests, verify pass**

Run: `cd packages/extension && bun test test/ext.test.ts` — PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/extension/src/shared packages/extension/test/ext.test.ts
git commit -m "feat(extension): shared message protocol and namespace shim"
```

---

### Task 4: Content-script signal collection

**Files:**
- Create: `packages/extension/src/content/collect.ts`, `packages/extension/src/content/index.ts`
- Test: `packages/extension/test/collect.test.ts`

**Interfaces:**
- Consumes: `PageSignals`, `CAPS`, `MAIN_WORLD_SOURCE`, `MainWorldMessage` from `../shared/protocol`; `ext` from `../shared/ext`.
- Produces: `collectSignals(doc: Document, url: string, selectors: string[]): Omit<PageSignals, 'js'>` — pure; caps applied. `src/content/index.ts` wires: collect on load, merge MAIN-world `js` (received via `window.postMessage`, validated by `source` and `event.origin === location.origin`), send `{type:'signals'}`; on `{type:'recollect'}` message, collect and send again.
- Note: `DOM_SELECTORS` is imported from a generated module `virtual:lists` — Task 8's build defines it; for tests, `collectSignals` takes selectors as a parameter.

- [ ] **Step 1: Write the failing test**

`packages/extension/test/collect.test.ts`:
```ts
import { expect, test } from 'bun:test'
import { Window } from 'happy-dom'
import { collectSignals } from '../src/content/collect'

function doc(html: string): Document {
  const w = new Window()
  w.document.write(html)
  return w.document as unknown as Document
}

test('collects meta, scripts, and matching dom selectors', () => {
  const d = doc(`<html><head>
    <meta name="Generator" content="WordPress 6.5">
    <meta property="og:title" content="x">
    <script src="https://cdn.example.com/app.js"></script>
    </head><body><div id="__next"></div></body></html>`)
  const s = collectSignals(d, 'https://example.com/', ['#__next', '#__nuxt'])
  expect(s.meta['generator']).toEqual(['WordPress 6.5'])
  expect(s.meta['og:title']).toEqual(['x'])
  expect(s.scripts).toEqual(['https://cdn.example.com/app.js'])
  expect(s.dom).toEqual(['#__next'])
  expect(s.url).toBe('https://example.com/')
})

test('caps html length and script count', () => {
  const many = Array.from({ length: 600 }, (_, i) => `<script src="/s${i}.js"></script>`).join('')
  const d = doc(`<html><body>${'x'.repeat(600_000)}${many}</body></html>`)
  const s = collectSignals(d, 'https://example.com/', [])
  expect(s.html.length).toBeLessThanOrEqual(500_000)
  expect(s.scripts.length).toBe(500)
})

test('a selector that throws is skipped', () => {
  const d = doc('<html><body></body></html>')
  const s = collectSignals(d, 'https://example.com/', ['::bogus!!', 'body'])
  expect(s.dom).toEqual(['body'])
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd packages/extension && bun test test/collect.test.ts` — FAIL, module not found.

- [ ] **Step 3: Implement collect.ts**

```ts
import { CAPS, type PageSignals } from '../shared/protocol'

export function collectSignals(
  doc: Document, url: string, selectors: string[],
): Omit<PageSignals, 'js'> {
  const meta: Record<string, string[]> = {}
  for (const el of doc.querySelectorAll('meta')) {
    const key = (el.getAttribute('name') ?? el.getAttribute('property'))?.toLowerCase()
    const content = el.getAttribute('content')
    if (!key || content === null) continue
    ;(meta[key] ??= []).push(content)
  }
  const scripts: string[] = []
  for (const el of doc.querySelectorAll('script[src]')) {
    if (scripts.length >= CAPS.scripts) break
    scripts.push((el as HTMLScriptElement).src || el.getAttribute('src') || '')
  }
  const dom: string[] = []
  for (const sel of selectors) {
    try { if (doc.querySelector(sel)) dom.push(sel) } catch { /* invalid selector */ }
  }
  const html = doc.documentElement?.outerHTML.slice(0, CAPS.html) ?? ''
  return { url, html, meta, scripts, dom }
}
```

- [ ] **Step 4: Run tests, verify pass**

Run: `cd packages/extension && bun test test/collect.test.ts` — PASS. If happy-dom returns absolute `src` values, assert with the resolved URL instead; keep the cap assertions untouched.

- [ ] **Step 5: Write index.ts wiring (no unit test; exercised by e2e)**

```ts
import { collectSignals } from './collect'
import { ext } from '../shared/ext'
import { MAIN_WORLD_SOURCE, type MainWorldMessage, type ToContent } from '../shared/protocol'
// DOM_SELECTORS is injected at build time (Task 8) via the "virtual:lists" module
import { DOM_SELECTORS } from 'virtual:lists'

let jsGlobals: Record<string, unknown> = {}

function send() {
  const signals = { ...collectSignals(document, location.href, DOM_SELECTORS), js: jsGlobals }
  ext.runtime.sendMessage({ type: 'signals', signals }).catch(() => {})
}

window.addEventListener('message', (event: MessageEvent) => {
  if (event.source !== window) return
  const data = event.data as MainWorldMessage
  if (data?.source !== MAIN_WORLD_SOURCE) return
  jsGlobals = data.js
  send()
})

ext.runtime.onMessage.addListener((msg: ToContent) => {
  if (msg.type === 'recollect') send()
})

send()
```
Add a module declaration `packages/extension/src/shared/virtual-lists.d.ts`:
```ts
declare module 'virtual:lists' {
  export const DOM_SELECTORS: string[]
  export const JS_PATHS: string[]
}
```

- [ ] **Step 6: Commit**

```bash
git add packages/extension/src/content packages/extension/src/shared/virtual-lists.d.ts packages/extension/test/collect.test.ts
git commit -m "feat(extension): content-script signal collection"
```

---

### Task 5: MAIN-world globals reader

**Files:**
- Create: `packages/extension/src/main-world/read-globals.ts`, `packages/extension/src/main-world/index.ts`
- Test: `packages/extension/test/read-globals.test.ts`

**Interfaces:**
- Consumes: `CAPS`, `MAIN_WORLD_SOURCE` from `../shared/protocol`; `JS_PATHS` from `virtual:lists`.
- Produces: `readGlobals(root: unknown, paths: string[], cap: number): Record<string, unknown>` — resolves dotted paths; includes a key only when the resolved value is neither `undefined` nor `null`; values are `String(value).slice(0, cap)`; property-getter throws are swallowed.

- [ ] **Step 1: Write the failing test**

`packages/extension/test/read-globals.test.ts`:
```ts
import { expect, test } from 'bun:test'
import { readGlobals } from '../src/main-world/read-globals'

test('resolves dotted paths and stringifies with cap', () => {
  const root = { React: { version: '18.3.1' }, jQuery: () => {}, big: 'x'.repeat(999) }
  const out = readGlobals(root, ['React.version', 'jQuery', 'big', 'missing.deep'], 200)
  expect(out['React.version']).toBe('18.3.1')
  expect(typeof out['jQuery']).toBe('string')
  expect((out['big'] as string).length).toBe(200)
  expect('missing.deep' in out).toBe(false)
})

test('a throwing getter is skipped', () => {
  const root: any = {}
  Object.defineProperty(root, 'trap', { get() { throw new Error('nope') } })
  expect(readGlobals(root, ['trap'], 200)).toEqual({})
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd packages/extension && bun test test/read-globals.test.ts` — FAIL, module not found.

- [ ] **Step 3: Implement read-globals.ts**

```ts
export function readGlobals(
  root: unknown, paths: string[], cap: number,
): Record<string, unknown> {
  const out: Record<string, unknown> = {}
  for (const path of paths) {
    try {
      let value: unknown = root
      for (const part of path.split('.')) {
        if (value === undefined || value === null) break
        value = (value as Record<string, unknown>)[part]
      }
      if (value === undefined || value === null) continue
      out[path] = String(value).slice(0, cap)
    } catch { /* hostile getter */ }
  }
  return out
}
```

- [ ] **Step 4: Run tests, verify pass**

Run: `cd packages/extension && bun test test/read-globals.test.ts` — PASS.

- [ ] **Step 5: Write index.ts wiring**

```ts
import { readGlobals } from './read-globals'
import { CAPS, MAIN_WORLD_SOURCE } from '../shared/protocol'
import { JS_PATHS } from 'virtual:lists'

window.postMessage(
  { source: MAIN_WORLD_SOURCE, js: readGlobals(window, JS_PATHS, CAPS.jsValue) },
  location.origin,
)
```

- [ ] **Step 6: Commit**

```bash
git add packages/extension/src/main-world packages/extension/test/read-globals.test.ts
git commit -m "feat(extension): MAIN-world globals reader"
```

---

### Task 6: Background assembly + session store

**Files:**
- Create: `packages/extension/src/background/assemble.ts`, `packages/extension/src/background/store.ts`
- Test: `packages/extension/test/assemble.test.ts`, `packages/extension/test/store.test.ts`

**Interfaces:**
- Consumes: `PageSignals`, `TabResult` from `../shared/protocol`; `SignalBundle` from `@opentechcheck/core`.
- Produces:
  - `toHeaderTable(headers: Array<{ name: string; value?: string }>): Record<string, string[]>` — lowercase names, multi-value preserved, missing value → `''`.
  - `toCookieRecord(cookies: Array<{ name: string; value: string }>): Record<string, string>` — first occurrence wins.
  - `toBundle(signals: PageSignals, headers: Record<string, string[]> | undefined, cookies: Record<string, string>): SignalBundle`.
  - `store.ts`: `getTab<T>(area, kind, tabId): Promise<T | null>`, `setTab(area, kind, tabId, value)`, `clearTab(area, tabId)` where `kind` is `'headers' | 'result'` and `area` is a `chrome.storage.StorageArea`-shaped object with promise `get`/`set`/`remove` (key format `${kind}:${tabId}`). Tests pass a Map-backed fake area.

- [ ] **Step 1: Write the failing tests**

`packages/extension/test/assemble.test.ts`:
```ts
import { expect, test } from 'bun:test'
import { toHeaderTable, toCookieRecord, toBundle } from '../src/background/assemble'

test('header names lowercase, multi-value preserved', () => {
  const t = toHeaderTable([
    { name: 'Set-Cookie', value: 'a=1' },
    { name: 'set-cookie', value: 'b=2' },
    { name: 'X-Empty' },
  ])
  expect(t['set-cookie']).toEqual(['a=1', 'b=2'])
  expect(t['x-empty']).toEqual([''])
})

test('cookie record: first wins', () => {
  expect(toCookieRecord([{ name: 's', value: '1' }, { name: 's', value: '2' }])).toEqual({ s: '1' })
})

test('toBundle maps every field', () => {
  const b = toBundle(
    { url: 'https://x.dev/', html: '<html>', meta: { generator: ['WP'] }, scripts: ['/a.js'], dom: ['#n'], js: { jQuery: 'f' } },
    { server: ['nginx'] },
    { sid: 'v' },
  )
  expect(b).toEqual({
    url: 'https://x.dev/', html: '<html>', meta: { generator: ['WP'] }, scripts: ['/a.js'],
    dom: ['#n'], js: { jQuery: 'f' }, headers: { server: ['nginx'] }, cookies: { sid: 'v' },
  })
})

test('undefined headers stay undefined so header rules skip', () => {
  const b = toBundle({ url: 'u', html: '', meta: {}, scripts: [], dom: [], js: {} }, undefined, {})
  expect(b.headers).toBeUndefined()
})
```

`packages/extension/test/store.test.ts`:
```ts
import { expect, test } from 'bun:test'
import { getTab, setTab, clearTab } from '../src/background/store'

function fakeArea() {
  const m = new Map<string, unknown>()
  return {
    m,
    get: async (k: string) => (m.has(k) ? { [k]: m.get(k) } : {}),
    set: async (obj: Record<string, unknown>) => { for (const [k, v] of Object.entries(obj)) m.set(k, v) },
    remove: async (keys: string | string[]) => { for (const k of [keys].flat()) m.delete(k) },
  }
}

test('set/get/clear round-trip per tab', async () => {
  const area = fakeArea()
  await setTab(area as any, 'headers', 7, { server: ['nginx'] })
  await setTab(area as any, 'result', 7, { url: 'u', detections: [] })
  expect(await getTab(area as any, 'headers', 7)).toEqual({ server: ['nginx'] })
  await clearTab(area as any, 7)
  expect(await getTab(area as any, 'headers', 7)).toBeNull()
  expect(await getTab(area as any, 'result', 7)).toBeNull()
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd packages/extension && bun test test/assemble.test.ts test/store.test.ts` — FAIL, modules not found.

- [ ] **Step 3: Implement**

`packages/extension/src/background/assemble.ts`:
```ts
import type { SignalBundle } from '@opentechcheck/core'
import type { PageSignals } from '../shared/protocol'

export function toHeaderTable(
  headers: Array<{ name: string; value?: string }>,
): Record<string, string[]> {
  const out: Record<string, string[]> = {}
  for (const h of headers) (out[h.name.toLowerCase()] ??= []).push(h.value ?? '')
  return out
}

export function toCookieRecord(
  cookies: Array<{ name: string; value: string }>,
): Record<string, string> {
  const out: Record<string, string> = {}
  for (const c of cookies) if (!(c.name in out)) out[c.name] = c.value
  return out
}

export function toBundle(
  signals: PageSignals,
  headers: Record<string, string[]> | undefined,
  cookies: Record<string, string>,
): SignalBundle {
  return {
    url: signals.url, html: signals.html, meta: signals.meta, scripts: signals.scripts,
    dom: signals.dom, js: signals.js, headers, cookies,
  }
}
```

`packages/extension/src/background/store.ts`:
```ts
type Area = {
  get(key: string): Promise<Record<string, unknown>>
  set(items: Record<string, unknown>): Promise<void>
  remove(keys: string | string[]): Promise<void>
}
type Kind = 'headers' | 'result'
const key = (kind: Kind, tabId: number) => `${kind}:${tabId}`

export async function getTab<T>(area: Area, kind: Kind, tabId: number): Promise<T | null> {
  const k = key(kind, tabId)
  const got = await area.get(k)
  return (got[k] as T | undefined) ?? null
}
export const setTab = (area: Area, kind: Kind, tabId: number, value: unknown) =>
  area.set({ [key(kind, tabId)]: value })
export const clearTab = (area: Area, tabId: number) =>
  area.remove([key('headers', tabId), key('result', tabId)])
```

- [ ] **Step 4: Run tests, verify pass**

Run: `cd packages/extension && bun test test/assemble.test.ts test/store.test.ts` — PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/extension/src/background packages/extension/test/assemble.test.ts packages/extension/test/store.test.ts
git commit -m "feat(extension): background bundle assembly and session store"
```

---

### Task 7: Background wiring (listeners, detect, badge, router)

**Files:**
- Create: `packages/extension/src/background/index.ts`
- Test: `packages/extension/test/background.test.ts`

**Interfaces:**
- Consumes: everything from Tasks 3 and 6; `detect` from `@opentechcheck/core`; registry via `import fingerprints from '@opentechcheck/fingerprints'`.
- Produces: `createBackground(api: BackgroundApi)` — all logic behind an injected API so tests need no real browser. `src/background/index.ts` ends with `createBackground(realApi(ext))` guarded by `if (typeof (globalThis as any).Bun === 'undefined')` so importing in tests registers nothing.

```ts
export interface BackgroundApi {
  session: { get(k: string): Promise<Record<string, unknown>>; set(i: Record<string, unknown>): Promise<void>; remove(k: string | string[]): Promise<void> }
  getCookies(url: string): Promise<Array<{ name: string; value: string }>>
  setBadge(tabId: number, text: string): void
  sendToTab(tabId: number, msg: ToContent): Promise<void>
  onHeaders(cb: (tabId: number, headers: Array<{ name: string; value?: string }>) => void): void
  onMessage(cb: (msg: ToBackground, tabId: number | undefined) => Promise<unknown> | void): void
  onCommitted(cb: (tabId: number) => void): void          // main-frame new document
  onHistoryUpdated(cb: (tabId: number) => void): void      // SPA navigation
  onTabRemoved(cb: (tabId: number) => void): void
  debounceMs: number
  setTimer(fn: () => void, ms: number): unknown
  clearTimer(t: unknown): void
}
```

Behavior contract (implement exactly):
1. `onHeaders(tabId, headers)` → `setTab(session, 'headers', tabId, toHeaderTable(headers))`.
2. `onMessage({type:'signals'}, tabId)` → read stored headers, `getCookies(signals.url)`, build bundle, `detect(bundle, fingerprints)`, store `TabResult`, `setBadge(tabId, count > 0 ? String(count) : '')`.
3. `onMessage({type:'get-result'}, tabIdOfActivePopupQuery)` → the popup passes no tabId; the router receives the popup's query as `{type:'get-result'}` and the api layer resolves the active tab id before calling the callback; callback returns the stored `TabResult | null`.
4. `onCommitted(tabId)` → remove only the `result:` key (headers for the new load already arrived or are about to; never clear them here), clear badge.
5. `onHistoryUpdated(tabId)` → debounce per tab by `debounceMs` using `setTimer`/`clearTimer`, then `sendToTab(tabId, {type:'recollect'})`.
6. `onTabRemoved(tabId)` → `clearTab(session, tabId)`.
7. Any handler error is caught and logged with `console.warn`; never throws out.

- [ ] **Step 1: Write the failing test**

`packages/extension/test/background.test.ts`:
```ts
import { expect, test } from 'bun:test'
import { createBackground, type BackgroundApi } from '../src/background/index'
import type { PageSignals } from '../src/shared/protocol'

function fakeApi() {
  const m = new Map<string, unknown>()
  const calls = { badge: [] as Array<[number, string]>, sent: [] as Array<[number, unknown]> }
  const handlers: any = {}
  const timers: Array<{ fn: () => void }> = []
  const api: BackgroundApi = {
    session: {
      get: async (k) => (m.has(k) ? { [k]: m.get(k) } : {}),
      set: async (i) => { for (const [k, v] of Object.entries(i)) m.set(k, v) },
      remove: async (keys) => { for (const k of [keys].flat()) m.delete(k) },
    },
    getCookies: async () => [{ name: 'sid', value: 'abc' }],
    setBadge: (id, text) => calls.badge.push([id, text]),
    sendToTab: async (id, msg) => { calls.sent.push([id, msg]) },
    onHeaders: (cb) => { handlers.headers = cb },
    onMessage: (cb) => { handlers.message = cb },
    onCommitted: (cb) => { handlers.committed = cb },
    onHistoryUpdated: (cb) => { handlers.history = cb },
    onTabRemoved: (cb) => { handlers.removed = cb },
    debounceMs: 500,
    setTimer: (fn) => { const t = { fn }; timers.push(t); return t },
    clearTimer: (t) => { const i = timers.indexOf(t as any); if (i >= 0) timers.splice(i, 1) },
  }
  return { api, m, calls, handlers, timers }
}

const signals: PageSignals = {
  url: 'https://example.com/', html: '<div id="__next"></div><script src="/_next/static/x.js"></script>',
  meta: {}, scripts: ['/_next/static/chunk.js'], dom: [], js: {},
}

test('signals message runs detection, stores result, sets badge', async () => {
  const { api, m, calls, handlers } = fakeApi()
  createBackground(api)
  handlers.headers(3, [{ name: 'Server', value: 'nginx/1.25.0' }])
  await handlers.message({ type: 'signals', signals }, 3)
  const result = m.get('result:3') as any
  const slugs = result.detections.map((d: any) => d.slug)
  expect(slugs).toContain('nextjs')
  expect(slugs).toContain('nginx')
  expect(calls.badge.at(-1)?.[0]).toBe(3)
  expect(Number(calls.badge.at(-1)?.[1])).toBeGreaterThan(0)
})

test('get-result returns stored result or null', async () => {
  const { api, handlers } = fakeApi()
  createBackground(api)
  expect(await handlers.message({ type: 'get-result' }, 9)).toBeNull()
  await handlers.message({ type: 'signals', signals }, 9)
  const res: any = await handlers.message({ type: 'get-result' }, 9)
  expect(res.url).toBe('https://example.com/')
})

test('committed clears result and badge but keeps headers', async () => {
  const { api, m, calls, handlers } = fakeApi()
  createBackground(api)
  handlers.headers(4, [{ name: 'Server', value: 'nginx' }])
  await handlers.message({ type: 'signals', signals }, 4)
  await handlers.committed(4)
  expect(m.has('result:4')).toBe(false)
  expect(m.has('headers:4')).toBe(true)
  expect(calls.badge.at(-1)).toEqual([4, ''])
})

test('history updates debounce into one recollect', async () => {
  const { api, calls, handlers, timers } = fakeApi()
  createBackground(api)
  handlers.history(5); handlers.history(5); handlers.history(5)
  expect(timers.length).toBe(1)
  timers[0]!.fn()
  await Promise.resolve()
  expect(calls.sent).toEqual([[5, { type: 'recollect' }]])
})

test('tab removal clears both keys', async () => {
  const { api, m, handlers } = fakeApi()
  createBackground(api)
  handlers.headers(6, [{ name: 'Server', value: 'nginx' }])
  await handlers.message({ type: 'signals', signals }, 6)
  await handlers.removed(6)
  expect(m.size).toBe(0)
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd packages/extension && bun test test/background.test.ts` — FAIL, module not found.

- [ ] **Step 3: Implement index.ts**

```ts
import { detect, type Fingerprint } from '@opentechcheck/core'
import registry from '@opentechcheck/fingerprints'
import { toBundle, toCookieRecord, toHeaderTable } from './assemble'
import { clearTab, getTab, setTab } from './store'
import { ext } from '../shared/ext'
import type { TabResult, ToBackground, ToContent } from '../shared/protocol'

const fingerprints = registry as unknown as Fingerprint[]

export interface BackgroundApi { /* exact interface from the task header */ }

export function createBackground(api: BackgroundApi): void {
  const timers = new Map<number, unknown>()

  api.onHeaders((tabId, headers) => {
    setTab(api.session, 'headers', tabId, toHeaderTable(headers)).catch(console.warn)
  })

  api.onMessage(async (msg: ToBackground, tabId) => {
    try {
      if (msg.type === 'signals' && tabId !== undefined) {
        const headers = await getTab<Record<string, string[]>>(api.session, 'headers', tabId)
        const cookies = toCookieRecord(await api.getCookies(msg.signals.url))
        const bundle = toBundle(msg.signals, headers ?? undefined, cookies)
        const detections = detect(bundle, fingerprints)
        const result: TabResult = { url: msg.signals.url, detections }
        await setTab(api.session, 'result', tabId, result)
        api.setBadge(tabId, detections.length > 0 ? String(detections.length) : '')
        return
      }
      if (msg.type === 'get-result' && tabId !== undefined) {
        return await getTab<TabResult>(api.session, 'result', tabId)
      }
      return null
    } catch (err) { console.warn('opentechcheck:', err); return null }
  })

  api.onCommitted((tabId) => {
    api.session.remove(`result:${tabId}`).catch(console.warn)
    api.setBadge(tabId, '')
  })

  api.onHistoryUpdated((tabId) => {
    const prev = timers.get(tabId)
    if (prev !== undefined) api.clearTimer(prev)
    timers.set(tabId, api.setTimer(() => {
      timers.delete(tabId)
      api.sendToTab(tabId, { type: 'recollect' } satisfies ToContent).catch(() => {})
    }, api.debounceMs))
  })

  api.onTabRemoved((tabId) => { clearTab(api.session, tabId).catch(console.warn) })
}

function realApi(c: typeof chrome): BackgroundApi {
  return {
    session: {
      get: (k) => c.storage.session.get(k),
      set: (i) => c.storage.session.set(i),
      remove: (k) => c.storage.session.remove(k),
    },
    getCookies: (url) => c.cookies.getAll({ url }),
    setBadge: (tabId, text) => { c.action.setBadgeText({ tabId, text }).catch(() => {}) },
    sendToTab: (tabId, msg) => c.tabs.sendMessage(tabId, msg),
    onHeaders: (cb) => c.webRequest.onHeadersReceived.addListener(
      (d) => { if (d.tabId >= 0) cb(d.tabId, d.responseHeaders ?? []) },
      { urls: ['<all_urls>'], types: ['main_frame'] }, ['responseHeaders'],
    ),
    onMessage: (cb) => c.runtime.onMessage.addListener((msg, sender, sendResponse) => {
      const tabId = sender.tab?.id ?? undefined
      const resolveTab = tabId !== undefined
        ? Promise.resolve(tabId)
        : c.tabs.query({ active: true, currentWindow: true }).then((t) => t[0]?.id)
      resolveTab.then((id) => cb(msg, id)).then(sendResponse, () => sendResponse(null))
      return true
    }),
    onCommitted: (cb) => c.webNavigation.onCommitted.addListener((d) => { if (d.frameId === 0) cb(d.tabId) }),
    onHistoryUpdated: (cb) => c.webNavigation.onHistoryStateUpdated.addListener((d) => { if (d.frameId === 0) cb(d.tabId) }),
    onTabRemoved: (cb) => c.tabs.onRemoved.addListener((id) => cb(id)),
    debounceMs: 500,
    setTimer: (fn, ms) => setTimeout(fn, ms),
    clearTimer: (t) => clearTimeout(t as ReturnType<typeof setTimeout>),
  }
}

if (typeof (globalThis as { Bun?: unknown }).Bun === 'undefined') {
  createBackground(realApi(ext))
}
```
Copy the `BackgroundApi` interface from the task header verbatim in place of the comment. Firefox's `cookies.getAll` and `action.setBadgeText` return promises under the `browser` namespace; Chrome ≥ 121 also returns promises, so no callback shims.

- [ ] **Step 4: Run tests, verify pass**

Run: `cd packages/extension && bun test test/background.test.ts` — PASS. The first test exercises the REAL registry: nextjs must fire from `id="__next"` + `/_next/static/`, nginx from the server header.

- [ ] **Step 5: Run the whole package suite**

Run: `cd packages/extension && bun test` — all green.

- [ ] **Step 6: Commit**

```bash
git add packages/extension/src/background/index.ts packages/extension/test/background.test.ts
git commit -m "feat(extension): background detection pipeline with injected api"
```

---

### Task 8: Build pipeline (vite, virtual lists, both targets)

**Files:**
- Create: `packages/extension/vite.config.ts`, `packages/extension/build/build.ts`
- Test: `packages/extension/test/build.test.ts` (runs the build, asserts outputs)

**Interfaces:**
- Consumes: `mergeManifest`, `jsPaths`, `domSelectors`, manifest JSONs.
- Produces: `bun run build` → `dist/chrome/` and `dist/firefox/`, each containing `manifest.json`, `background.js`, `content.js`, `main-world.js`, `popup.html`, `popup.js`, `popup.css`. A vite plugin `listsPlugin()` resolves `virtual:lists` to generated constants. Content and MAIN-world scripts are IIFE (classic scripts); background is IIFE too so one file serves both browsers.

- [ ] **Step 1: Write vite.config.ts**

```ts
import { defineConfig } from 'vite'
import { svelte } from '@sveltejs/vite-plugin-svelte'
import tailwindcss from '@tailwindcss/vite'
import { jsPaths, domSelectors } from './build/generate-lists'
import type { Fingerprint } from '@opentechcheck/core'
import registry from '@opentechcheck/fingerprints'
import type { Plugin } from 'vite'

const fps = registry as unknown as Fingerprint[]

export function listsPlugin(): Plugin {
  return {
    name: 'opentechcheck-lists',
    resolveId: (id) => (id === 'virtual:lists' ? '\0virtual:lists' : undefined),
    load: (id) =>
      id === '\0virtual:lists'
        ? `export const JS_PATHS = ${JSON.stringify(jsPaths(fps))};\n` +
          `export const DOM_SELECTORS = ${JSON.stringify(domSelectors(fps))};`
        : undefined,
  }
}

// entry is selected by build.ts via --mode; each script entry builds as a
// single-file IIFE (content scripts and the Firefox event page are classic scripts)
export default defineConfig(({ mode }) => {
  const outDir = process.env.OTC_OUTDIR ?? 'dist/chrome'
  if (mode === 'popup') {
    return {
      plugins: [svelte(), tailwindcss(), listsPlugin()],
      base: './',
      build: {
        outDir, emptyOutDir: false,
        rollupOptions: {
          input: 'src/popup/popup.html',
          output: { entryFileNames: 'popup.js', assetFileNames: 'popup[extname]' },
        },
      },
    }
  }
  const entries: Record<string, string> = {
    background: 'src/background/index.ts',
    content: 'src/content/index.ts',
    'main-world': 'src/main-world/index.ts',
  }
  return {
    plugins: [listsPlugin()],
    build: {
      outDir, emptyOutDir: false,
      lib: { entry: entries[mode]!, formats: ['iife'], name: 'otc', fileName: () => `${mode}.js` },
    },
  }
})
```

- [ ] **Step 2: Write build/build.ts**

```ts
import { mkdirSync, writeFileSync, renameSync, existsSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import { build } from 'vite'
import { mergeManifest } from './manifest'
import base from '../manifest/base.json'
import chromeOverlay from '../manifest/chrome.json'
import firefoxOverlay from '../manifest/firefox.json'

const root = join(import.meta.dir, '..')
const overlays = { chrome: chromeOverlay, firefox: firefoxOverlay } as const

for (const target of ['chrome', 'firefox'] as const) {
  const outDir = join(root, 'dist', target)
  rmSync(outDir, { recursive: true, force: true })
  mkdirSync(outDir, { recursive: true })
  process.env.OTC_OUTDIR = outDir
  for (const mode of ['background', 'content', 'main-world', 'popup']) {
    await build({ root, mode, configFile: join(root, 'vite.config.ts') })
  }
  // vite emits the popup page at its source path; hoist it to the dist root
  const nested = join(outDir, 'src', 'popup', 'popup.html')
  if (existsSync(nested)) {
    renameSync(nested, join(outDir, 'popup.html'))
    rmSync(join(outDir, 'src'), { recursive: true, force: true })
  }
  writeFileSync(
    join(outDir, 'manifest.json'),
    JSON.stringify(mergeManifest(base, overlays[target]), null, 2),
  )
  console.log(`built dist/${target}`)
}
```
The popup.html hoist must also rewrite the html's relative asset references if vite emits `../../popup.js` style paths — after the first build, inspect `dist/chrome/popup.html` and if needed post-process with `String.replace(/(\.\.\/)+/g, '')` before writing. Encode whatever the actual output requires; the test in Step 3 is the arbiter.

- [ ] **Step 3: Write the build verification test**

`packages/extension/test/build.test.ts`:
```ts
import { expect, test } from 'bun:test'
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { $ } from 'bun'

const root = join(import.meta.dir, '..')

test('build emits both targets with correct manifests', async () => {
  await $`bun run ${join(root, 'build', 'build.ts')}`.cwd(root)
  for (const target of ['chrome', 'firefox']) {
    for (const f of ['manifest.json', 'background.js', 'content.js', 'main-world.js', 'popup.html', 'popup.js']) {
      expect(existsSync(join(root, 'dist', target, f))).toBe(true)
    }
    const manifest = JSON.parse(readFileSync(join(root, 'dist', target, 'manifest.json'), 'utf8'))
    expect(manifest.permissions).toEqual(['webRequest', 'cookies', 'storage', 'webNavigation', 'tabs'])
    const html = readFileSync(join(root, 'dist', target, 'popup.html'), 'utf8')
    expect(html).toContain('popup.js')
    expect(html).not.toContain('../')
  }
  const chrome = JSON.parse(readFileSync(join(root, 'dist', 'chrome', 'manifest.json'), 'utf8'))
  const firefox = JSON.parse(readFileSync(join(root, 'dist', 'firefox', 'manifest.json'), 'utf8'))
  expect(chrome.background.service_worker).toBe('background.js')
  expect(firefox.background.scripts).toEqual(['background.js'])
  const content = readFileSync(join(root, 'dist', 'chrome', 'content.js'), 'utf8')
  expect(content).not.toContain('virtual:lists')
}, 120_000)
```
This test requires the popup files from Task 9. Until Task 9 lands, create placeholder `src/popup/popup.html` (`<!doctype html><html><head><script type="module" src="./main.ts"></script></head><body></body></html>`), `src/popup/main.ts` (`export {}`), so the pipeline builds; Task 9 replaces them.

- [ ] **Step 4: Run test, iterate until pass**

Run: `cd packages/extension && bun test test/build.test.ts`
Expected: PASS after resolving vite's actual output layout (the hoist/rewrite note in Step 2). `git status` must show only intended files; add `packages/extension/dist/` to the repo `.gitignore`.

- [ ] **Step 5: Commit**

```bash
git add packages/extension/vite.config.ts packages/extension/build/build.ts packages/extension/test/build.test.ts packages/extension/src/popup .gitignore
git commit -m "feat(extension): vite build pipeline for chrome and firefox targets"
```

---

### Task 9: Popup — format logic and Svelte UI

**Files:**
- Create: `packages/extension/src/popup/format.ts`, `packages/extension/src/popup/App.svelte`, `packages/extension/src/popup/main.ts`, `packages/extension/src/popup/app.css`
- Replace: `packages/extension/src/popup/popup.html` placeholder
- Test: `packages/extension/test/format.test.ts`

**Interfaces:**
- Consumes: `Detection` from `@opentechcheck/core`; `TabResult`, `ToBackground` from `../shared/protocol`; `ext` from `../shared/ext`.
- Produces (in `format.ts`):
  - `grade(confidence: number): 'A' | 'B' | 'C' | 'D'` — A ≥ 90, B ≥ 75, C ≥ 60, D below.
  - `CATEGORY_ORDER: string[]` — exactly: `['js-framework', 'web-framework', 'ui-framework', 'js-library', 'cms', 'ecommerce', 'payment', 'analytics', 'tag-manager', 'marketing', 'security', 'hosting', 'cdn', 'server', 'database', 'other']`.
  - `groupByCategory(detections: Detection[]): Array<{ category: string; items: Detection[] }>` — groups in `CATEGORY_ORDER` order (unknown categories last, alphabetical); items sorted by confidence desc, then name asc.
  - `stackSummary(detections: Detection[]): string` — one line per detection in grouped order: `Name 1.2.3` (version only when non-null), joined with `\n`.
  - `exportPayload(result: TabResult): string` — `JSON.stringify({ url, detections: [{ slug, name, category, version, confidence, grade, evidence }] }, null, 2)` where `grade` is added per detection.

- [ ] **Step 1: Write the failing test**

`packages/extension/test/format.test.ts`:
```ts
import { expect, test } from 'bun:test'
import { grade, groupByCategory, stackSummary, exportPayload, CATEGORY_ORDER } from '../src/popup/format'
import type { Detection } from '@opentechcheck/core'

const d = (slug: string, category: string, confidence: number, version: string | null = null): Detection =>
  ({ slug, name: slug.toUpperCase(), category, confidence, version, evidence: [] })

test('grade boundaries', () => {
  expect(grade(90)).toBe('A'); expect(grade(89)).toBe('B')
  expect(grade(75)).toBe('B'); expect(grade(74)).toBe('C')
  expect(grade(60)).toBe('C'); expect(grade(59)).toBe('D')
})

test('groups follow CATEGORY_ORDER with confidence-desc items', () => {
  const groups = groupByCategory([d('nginx', 'server', 100), d('react', 'js-framework', 100), d('vue', 'js-framework', 80)])
  expect(groups.map((g) => g.category)).toEqual(['js-framework', 'server'])
  expect(groups[0]!.items.map((i) => i.slug)).toEqual(['react', 'vue'])
  expect(CATEGORY_ORDER[0]).toBe('js-framework')
})

test('unknown category sorts last', () => {
  const groups = groupByCategory([d('x', 'zzz-new', 100), d('nginx', 'server', 100)])
  expect(groups.map((g) => g.category)).toEqual(['server', 'zzz-new'])
})

test('stack summary includes versions only when present', () => {
  const s = stackSummary([d('react', 'js-framework', 100, '18.3.1'), d('nginx', 'server', 100)])
  expect(s).toBe('REACT 18.3.1\nNGINX')
})

test('export payload carries grades, never percentages in keys', () => {
  const out = JSON.parse(exportPayload({ url: 'https://x.dev/', detections: [d('react', 'js-framework', 82)] }))
  expect(out.detections[0].grade).toBe('B')
  expect(out.detections[0].confidence).toBe(82)
  expect(out.url).toBe('https://x.dev/')
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd packages/extension && bun test test/format.test.ts` — FAIL, module not found.

- [ ] **Step 3: Implement format.ts**

```ts
import type { Detection } from '@opentechcheck/core'
import type { TabResult } from '../shared/protocol'

export const CATEGORY_ORDER = [
  'js-framework', 'web-framework', 'ui-framework', 'js-library', 'cms', 'ecommerce',
  'payment', 'analytics', 'tag-manager', 'marketing', 'security', 'hosting', 'cdn',
  'server', 'database', 'other',
]

export function grade(confidence: number): 'A' | 'B' | 'C' | 'D' {
  if (confidence >= 90) return 'A'
  if (confidence >= 75) return 'B'
  if (confidence >= 60) return 'C'
  return 'D'
}

export function groupByCategory(detections: Detection[]): Array<{ category: string; items: Detection[] }> {
  const byCat = new Map<string, Detection[]>()
  for (const det of detections) (byCat.get(det.category) ?? byCat.set(det.category, []).get(det.category)!).push(det)
  const rank = (c: string) => { const i = CATEGORY_ORDER.indexOf(c); return i === -1 ? CATEGORY_ORDER.length : i }
  return [...byCat.entries()]
    .sort(([a], [b]) => rank(a) - rank(b) || a.localeCompare(b))
    .map(([category, items]) => ({
      category,
      items: items.sort((x, y) => y.confidence - x.confidence || x.name.localeCompare(y.name)),
    }))
}

export function stackSummary(detections: Detection[]): string {
  return groupByCategory(detections)
    .flatMap((g) => g.items)
    .map((det) => (det.version ? `${det.name} ${det.version}` : det.name))
    .join('\n')
}

export function exportPayload(result: TabResult): string {
  return JSON.stringify({
    url: result.url,
    detections: result.detections.map((det) => ({
      slug: det.slug, name: det.name, category: det.category,
      version: det.version, confidence: det.confidence, grade: grade(det.confidence),
      evidence: det.evidence,
    })),
  }, null, 2)
}
```

- [ ] **Step 4: Run tests, verify pass**

Run: `cd packages/extension && bun test test/format.test.ts` — PASS.

- [ ] **Step 5: Write the Svelte popup**

`packages/extension/src/popup/popup.html`:
```html
<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <title>OpenTechCheck</title>
    <script type="module" src="./main.ts"></script>
  </head>
  <body></body>
</html>
```

`packages/extension/src/popup/app.css`:
```css
@import 'tailwindcss';
```

`packages/extension/src/popup/main.ts`:
```ts
import { mount } from 'svelte'
import './app.css'
import App from './App.svelte'

mount(App, { target: document.body })
```

`packages/extension/src/popup/App.svelte`:
```svelte
<script lang="ts">
  import { ext } from '../shared/ext'
  import { grade, groupByCategory, stackSummary, exportPayload } from './format'
  import type { TabResult } from '../shared/protocol'

  let state = $state<'loading' | 'ready' | 'uninspectable'>('loading')
  let result = $state<TabResult | null>(null)
  let expanded = $state<string | null>(null)

  const load = async () => {
    const [tab] = await ext.tabs.query({ active: true, currentWindow: true })
    if (!tab?.url || !/^https?:/.test(tab.url)) { state = 'uninspectable'; return }
    result = (await ext.runtime.sendMessage({ type: 'get-result' })) as TabResult | null
    state = 'ready'
  }
  load()

  const copyStack = () => navigator.clipboard.writeText(stackSummary(result?.detections ?? []))
  const exportJson = () => {
    if (!result) return
    const url = URL.createObjectURL(new Blob([exportPayload(result)], { type: 'application/json' }))
    const a = document.createElement('a')
    a.href = url
    a.download = `opentechcheck-${new URL(result.url).hostname}.json`
    a.click()
    URL.revokeObjectURL(url)
  }
</script>

<main class="w-96 p-3 text-sm">
  {#if state === 'loading'}
    <p class="text-gray-500">Detecting…</p>
  {:else if state === 'uninspectable'}
    <p class="text-gray-500">This page cannot be inspected.</p>
  {:else if !result || result.detections.length === 0}
    <p class="text-gray-500">No technologies detected.</p>
  {:else}
    {#each groupByCategory(result.detections) as group}
      <section class="mb-3">
        <h2 class="mb-1 font-semibold uppercase tracking-wide text-xs text-gray-400">{group.category}</h2>
        {#each group.items as det}
          <button
            class="flex w-full items-center justify-between rounded px-1 py-0.5 text-left hover:bg-gray-100"
            onclick={() => (expanded = expanded === det.slug ? null : det.slug)}
          >
            <span>
              {det.name}
              {#if det.version}<span class="text-gray-500">{det.version}</span>{/if}
            </span>
            <span class="rounded bg-gray-200 px-1 font-mono text-xs">{grade(det.confidence)}</span>
          </button>
          {#if expanded === det.slug}
            <div class="mb-1 ml-2 border-l pl-2 text-xs text-gray-600">
              {#each det.evidence as ev}
                <div><span class="font-mono">{ev.source}{ev.key ? `:${ev.key}` : ''}</span> — {ev.match || ev.pattern}</div>
              {/each}
              <a class="text-blue-600" href={(result.detections.find((d) => d.slug === det.slug) as any).website ?? '#'} target="_blank" rel="noreferrer">website</a>
            </div>
          {/if}
        {/each}
      </section>
    {/each}
    <footer class="flex gap-2 border-t pt-2">
      <button class="rounded bg-gray-800 px-2 py-1 text-white" onclick={copyStack}>Copy stack</button>
      <button class="rounded border px-2 py-1" onclick={exportJson}>Export JSON</button>
    </footer>
  {/if}
</main>
```
`Detection` has no `website` field. Add it to the popup by joining against the registry: in `format.ts` add
```ts
import registry from '@opentechcheck/fingerprints'
const sites = new Map((registry as Array<{ slug: string; website: string }>).map((f) => [f.slug, f.website]))
export const websiteOf = (slug: string): string | undefined => sites.get(slug)
```
and in `App.svelte` replace the `href` expression with `websiteOf(det.slug) ?? '#'`. Add a test to `format.test.ts`: `expect(websiteOf('react')).toContain('react')`.

- [ ] **Step 6: Rebuild and run all package tests**

Run: `cd packages/extension && bun test`
Expected: all pass, including the Task 8 build test now bundling the real popup.

- [ ] **Step 7: Commit**

```bash
git add packages/extension/src/popup packages/extension/test/format.test.ts
git commit -m "feat(extension): popup ui with grades, evidence view, copy and export"
```

---

### Task 10: E2E smoke test

**Files:**
- Create: `packages/extension/e2e/fixture/index.html`, `packages/extension/e2e/serve.ts`, `packages/extension/e2e/smoke.test.ts`

**Interfaces:**
- Consumes: `dist/chrome` from the build; puppeteer.
- Produces: a `bun test e2e/` suite, excluded from the default unit run only by its directory (CI invokes it as a separate step).

- [ ] **Step 1: Write the fixture page**

`packages/extension/e2e/fixture/index.html`:
```html
<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <meta name="generator" content="WordPress 6.5" />
    <script src="/wp-includes/js/jquery/jquery.min.js"></script>
  </head>
  <body>
    <div id="__next"></div>
    <script src="/_next/static/chunks/main.js"></script>
  </body>
</html>
```

`packages/extension/e2e/serve.ts`:
```ts
import { join } from 'node:path'

export function serveFixture(port: number) {
  return Bun.serve({
    port,
    fetch(req) {
      const path = new URL(req.url).pathname
      if (path === '/' || path === '/index.html') {
        return new Response(Bun.file(join(import.meta.dir, 'fixture', 'index.html')), {
          headers: { 'content-type': 'text/html', server: 'nginx/1.25.0' },
        })
      }
      return new Response('// stub', { headers: { 'content-type': 'text/javascript' } })
    },
  })
}
```

- [ ] **Step 2: Write the smoke test**

`packages/extension/e2e/smoke.test.ts`:
```ts
import { afterAll, beforeAll, expect, test } from 'bun:test'
import { join } from 'node:path'
import puppeteer, { type Browser } from 'puppeteer'
import { serveFixture } from './serve'

const EXT = join(import.meta.dir, '..', 'dist', 'chrome')
const PORT = 8123
let browser: Browser
let server: ReturnType<typeof serveFixture>

beforeAll(async () => {
  server = serveFixture(PORT)
  browser = await puppeteer.launch({
    headless: true,
    args: [`--disable-extensions-except=${EXT}`, `--load-extension=${EXT}`],
  })
})
afterAll(async () => { await browser?.close(); server?.stop() })

test('badge and stored result reflect fixture detections', async () => {
  const page = await browser.newPage()
  await page.goto(`http://localhost:${PORT}/`, { waitUntil: 'networkidle0' })

  const workerTarget = await browser.waitForTarget((t) => t.type() === 'service_worker', { timeout: 15_000 })
  const worker = await workerTarget.worker()
  if (!worker) throw new Error('no service worker')

  const slugs: string[] = await worker.evaluate(async () => {
    for (let i = 0; i < 50; i++) {
      const all = await chrome.storage.session.get(null)
      const key = Object.keys(all).find((k) => k.startsWith('result:'))
      if (key) return (all[key] as { detections: Array<{ slug: string }> }).detections.map((d) => d.slug)
      await new Promise((r) => setTimeout(r, 200))
    }
    return []
  })

  expect(slugs).toContain('nextjs')
  expect(slugs).toContain('wordpress')
  expect(slugs).toContain('nginx')
  await page.close()
}, 60_000)
```

- [ ] **Step 3: Build, then run the smoke test**

Run: `cd packages/extension && bun run build && bun test e2e/`
Expected: PASS. Known flake sources: service worker not yet spawned (the waitForTarget covers it) and headless extension support (modern puppeteer headless supports MV3 extensions). If the worker target never appears, retry once with `headless: false` locally to separate environment failure from code failure.

- [ ] **Step 4: Confirm unit runs stay isolated**

Run: `cd packages/extension && bun test test/` — unit suite passes without the e2e directory. Adjust the package `test` script to `bun test test/` so the default run excludes e2e.

- [ ] **Step 5: Commit**

```bash
git add packages/extension/e2e packages/extension/package.json
git commit -m "test(extension): e2e smoke via headless chromium"
```

---

### Task 11: CI, README, final verification

**Files:**
- Modify: `.github/workflows/ci.yml`, `README.md`

**Interfaces:**
- Consumes: everything prior.
- Produces: CI builds both targets and runs unit + e2e suites; README documents the extension.

- [ ] **Step 1: Extend CI**

Read `.github/workflows/ci.yml` first and match its idiom (bun setup steps, job naming). Add steps to the existing job (or a new `extension` job if the file separates per-package jobs):
```yaml
      - name: Extension unit tests
        run: cd packages/extension && bun test test/
      - name: Extension build
        run: cd packages/extension && bun run build
      - name: Extension e2e
        run: cd packages/extension && bun test e2e/
```
Puppeteer downloads Chromium during `bun install` on ubuntu runners; if the runner needs system libs, add `sudo apt-get install -y libnss3 libatk-bridge2.0-0 libgtk-3-0 libgbm1` before the e2e step — include it only if CI actually fails without it.

- [ ] **Step 2: README section**

Append to the repo README, matching its existing tone and heading level:
```markdown
## Browser extension

Local-only technology detection for the current page (Chrome ≥ 121, Firefox ≥ 121).

    bun run compile          # refresh the fingerprint registry
    cd packages/extension
    bun run build            # emits dist/chrome and dist/firefox

Load `dist/chrome` via chrome://extensions → "Load unpacked" (enable Developer mode),
or `dist/firefox` via about:debugging → "Load Temporary Add-on". Detection runs
entirely in your browser; no request ever leaves it.
```

- [ ] **Step 3: Full verification from repo root**

Run, in order, from repo root:
```bash
bun test
bun run typecheck
cd packages/extension && bun run build && bun test test/ && bun test e2e/
```
Expected: everything green.

- [ ] **Step 4: Commit**

```bash
git add .github/workflows/ci.yml README.md
git commit -m "chore(extension): ci wiring and readme"
```

---

## Self-Review Notes

- Spec coverage: badge (T7), categorized results + grades + versions + evidence + links (T9), copy/export (T9), headers via webRequest (T7), cookies (T7), MAIN-world allowlist (T2+T5), SPA re-detect (T7), per-tab cache in storage.session (T6/T7), uninspectable states (T9), cross-browser manifests (T1/T8), e2e (T10), CI (T11). Stylesheet URLs are consciously dropped: the core has no stylesheet source (spec deviation recorded here).
- The spec's "This page cannot be inspected" and "No technologies detected" copies appear verbatim in T9.
- Type names used across tasks: `PageSignals`, `TabResult`, `ToBackground`, `ToContent`, `BackgroundApi`, `CAPS`, `MAIN_WORLD_SOURCE` — defined once in T3/T7 and imported elsewhere.
