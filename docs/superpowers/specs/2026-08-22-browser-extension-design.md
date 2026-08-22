# Browser Extension — Design

Date: 2026-08-22
Status: approved for planning
Scope: IDEA.md Phase 2 (`@opentechcheck/extension`)

## Goal

A Chrome and Firefox extension that detects the technologies a page uses,
fully locally. It reuses `@opentechcheck/core` for matching and the compiled
`fingerprints.json` from `@opentechcheck/fingerprints` as its registry.

## Decisions (settled with the user)

- Always-on detection with a per-tab badge count. Host permission covers all
  sites; `webRequest` (observational) captures real response headers.
- No network requests leave the browser. The registry is bundled at build
  time; registry updates ship as extension releases. No telemetry.
- Targets: Chrome/Chromium ≥ 121 and Firefox ≥ 128, MV3, one codebase.
  Firefox's floor tracks its `world: "MAIN"` content-script support.
- Confidence appears as a grade, never a percentage:
  A ≥ 90, B ≥ 75, C ≥ 60, D < 60.
- V1 features: categorized results, version display, grades, evidence view,
  badge count, technology website links, copy stack summary, export JSON.

## Architecture (background-centric)

One copy of the registry and matcher lives in the background worker. Web
pages never execute matcher code. The popup is a pure renderer.

```
content script (ISOLATED)  ──┐
  html, meta, dom,           │ signals
  script/stylesheet URLs     │
injected script (MAIN)     ──┤──► background worker ──► popup (Svelte)
  js globals (allowlist)     │      merge signals            render per-tab
                             │      + headers (webRequest)   result
headers, cookies ────────────┘      + cookies (cookies API)
  (background APIs)                 run detect()
                                    cache per tab, set badge
```

### Components

- **Content script** (`document_idle`, all sites, ISOLATED world): collects
  serialized html (capped at 500 KB), meta name→content map, script and
  stylesheet URLs (capped at 500 entries), and dom-rule presence checks.
  Sends one message per collection run.
- **MAIN-world script** (declared in the manifest with `"world": "MAIN"`):
  reads only the JS globals named by the registry's `js` rules. The
  allowlist is generated at build time from `fingerprints.json`, so the
  page cannot be probed beyond what the registry defines. Values are
  stringified with a length cap before crossing worlds.
- **Background worker**: subscribes to `webRequest.onHeadersReceived`
  (main_frame only) and stores headers by tab; reads cookies for the tab's
  URL via the `cookies` API; assembles the `SignalBundle`; runs `detect()`;
  caches the result in `storage.session` keyed by tab id (survives service
  worker suspension); sets the badge text to the detection count.
- **Popup** (Svelte + Tailwind, compiled, no runtime framework): requests
  the active tab's cached result from the background and renders it.

### Data flow and lifecycle

1. Main-frame response arrives → background records headers for the tab.
2. Page reaches `document_idle` → content script and MAIN-world script
   collect and send signals.
3. Background merges signals + headers + cookies, runs `detect()`, caches,
   updates the badge.
4. SPA navigation: `webNavigation.onHistoryStateUpdated` (debounced 500 ms)
   asks the content script to re-collect; steps 2–3 repeat with the
   original load's headers retained.
5. Tab close or main-frame navigation clears the previous cache entry.

### Cross-browser layer

- One `ext` shim module resolves `browser` (Firefox) vs `chrome` (Chromium)
  and promisifies where needed.
- Background: `service_worker` for Chrome, `background.scripts` event page
  for Firefox. The build emits `dist/chrome` and `dist/firefox` with
  browser-specific manifest fragments merged over a shared base.
- Everything else (content scripts, popup, matcher) is identical.

### Permissions

`host_permissions: <all_urls>`, `webRequest`, `cookies`, `storage`,
`webNavigation`. No `scripting`, no `downloads` (export uses an object URL
from the popup), no remote code.

## UI

- **Badge**: count of detected technologies; empty on zero or uninspectable
  pages.
- **Popup list**: grouped by category in a fixed order (frameworks first,
  infrastructure last). Row: name, version when resolved, grade chip, link
  to the technology's website.
- **Evidence view**: a row expands to show each matched rule — signal
  source, pattern, and the matched text excerpt — straight from the
  engine's evidence output.
- **Footer**: "Copy stack" (plain-text list to clipboard) and
  "Export JSON" (full result: slugs, names, categories, versions,
  confidence, grades, evidence).
- **States**: "No technologies detected", and "This page cannot be
  inspected" for chrome://, about:, extension stores, and file/PDF viewers.

## Error handling

- Collection failures (CSP-blocked injection, dead frame) degrade to the
  signals that did arrive; detection runs on the partial bundle.
- A malformed message or oversized payload is dropped and logged to the
  extension console; the badge shows the last good result.
- The engine's broken-regex isolation already prevents one bad pattern
  from killing a run.

## Testing

- Unit: signal collector against captured DOM fixtures; bundle assembly and
  cache lifecycle in the background (headers arrive before/after signals,
  SPA re-runs, tab teardown); grade mapping; manifest merge.
- E2E smoke: load `dist/chrome` in headless Chromium, open a local fixture
  page with known markers, assert badge count and popup rows.
- CI: build both targets, run the suites, fail on manifest/permission
  drift.

## Out of scope for v1

Store submission and signing, options page, per-site disable, API-powered
enrichment, registry auto-update, Safari.
