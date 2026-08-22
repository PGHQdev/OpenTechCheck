# OpenTechCheck — Detection Engine and Fingerprint Registry Design

Date: 2026-08-22
Status: Approved design, pending implementation plan
Scope: Phase 1 of OpenTechCheck (see IDEA.md). Engine + fingerprints only.

## 1. Goal

Build the open-source core of OpenTechCheck: a portable technology-detection
engine and a tested fingerprint registry. Every later client (extension, CLI,
MCP server) and the private hosted API consume this engine as npm packages.

Success criteria:

- `detect(bundle, fingerprints)` returns correct detections with confidence,
  version, and evidence for ~100 high-value technologies.
- The engine runs unchanged in browsers, Node/Bun, and Cloudflare Workers.
- A contributor can add a technology with one YAML file and one fixture.

## 2. Decisions Made

- **Clean-room fingerprints.** Own YAML schema, Apache-2.0. No import of the
  GPL Wappalyzer-fork dataset (e.g. enthec/webappanalyzer).
- **Open/closed split.** This public monorepo holds the engine, fingerprints,
  and all clients. The hosted API backend lives in a separate private repo and
  consumes the published npm packages. No shared git history.
- **Stack.** TypeScript, Bun workspaces monorepo. `@opentechcheck/core` has
  zero runtime dependencies and performs no I/O.
- **Declarative engine (Approach A).** Fingerprints are data only. No plugin
  code in fingerprints. A build step compiles YAML to one JSON artifact.
- **License.** Apache-2.0 for everything in this repo.

Rejected alternatives: plugin detectors with embedded JavaScript
(supply-chain risk in the extension, review burden, portability loss);
wrapping httpx as Stackray does (Go binary cannot run in an extension or
Workers, detection logic stays external).

Stackray (MIT) remains a reference for the later private backend: its
worker/queue architecture and its two-pass scan model (HTTP pass, then
browser pass) match this design's collector split.

## 3. Repository Layout

Public monorepo `opentechcheck/opentechcheck`, Bun workspaces:

```text
packages/
  core/          @opentechcheck/core         types, matcher, confidence, evidence
  fingerprints/  @opentechcheck/fingerprints YAML sources, compiler, compiled JSON
  collect-http/  @opentechcheck/collect-http fetch-based collector
schemas/         JSON Schema for fingerprints; categories.json
fixtures/        saved SignalBundle snapshots per technology
docs/
```

Data flow:

```text
URL or page
   -> collector produces SignalBundle (plain JSON object)
   -> matcher(bundle, fingerprints) produces Detection[]
```

- `collect-http` uses only `fetch`, so it also runs on Workers. It extracts
  html, headers, cookies, meta tags, and script URLs from one response.
- Browser-runtime collectors (DOM, JS globals) arrive later with the
  extension as a separate package. The schema supports them from day one, so
  the extension needs no schema change.
- `fingerprints` ships compiled JSON plus YAML sources. Consumers load JSON
  and never parse YAML at runtime.

## 4. Fingerprint Schema

One YAML file per technology at
`packages/fingerprints/src/<category>/<name>.yaml`:

```yaml
name: Next.js
slug: nextjs
category: web-framework
website: https://nextjs.org
implies: [react]
excludes: []

detect:
  html:
    - pattern: '__NEXT_DATA__'
  scripts:
    - pattern: '/_next/static/'
  headers:
    x-powered-by:
      - pattern: 'Next\.js(?:\s([\d.]+))?'
        version: 1          # capture group index for the version
        confidence: 100
  meta: {}
  cookies: {}
  js: {}                    # extension-only, empty for now
  dom: {}                   # extension-only, empty for now
```

Rules:

- Every rule is a structured object: `pattern` (regex string), optional
  `version` (capture group index), optional `confidence` (integer 0-100,
  default 100). No inline `\;version:\1` string conventions.
- The compiler rejects patterns with catastrophic-backtracking risk (nested
  quantifiers) via a lint rule, because untrusted page content feeds the
  matcher.
- `implies` adds technologies at reduced confidence with evidence
  `implied-by: <slug>`. `excludes` suppresses a technology when this one
  matches.
- `slug` is the stable identifier; `name` is display text. Categories come
  from one controlled list in `schemas/categories.json`.
- The compiler validates every file against the JSON Schema, checks that
  `implies`/`excludes` reference existing slugs, and emits one
  `fingerprints.json`.

## 5. Matcher Semantics

Input:

```ts
interface SignalBundle {
  url: string
  html?: string
  headers?: Record<string, string[]>
  cookies?: Record<string, string>
  meta?: Record<string, string[]>      // name -> content values
  scripts?: string[]                    // script src URLs
  js?: Record<string, unknown>          // global name -> value (extension)
  dom?: string[]                        // matched selector list (extension)
}
```

Output:

```ts
interface Detection {
  slug: string
  name: string
  category: string
  confidence: number        // 0-100
  version: string | null
  evidence: Evidence[]      // { source, pattern, match }
}
```

Behavior:

- The matcher runs every rule against the fields present in the bundle.
  Absent fields are skipped, never errors. One engine serves both a thin
  HTTP scan and a full browser scan.
- Confidence per technology = maximum rule confidence, plus 5 points per
  additional distinct source that matches, capped at 100. Implied
  technologies receive the source technology's confidence × 0.9.
- Version: the first non-empty capture wins. When two rules capture
  different versions, the higher-confidence rule wins.
- Every matched rule appends one evidence entry. Evidence from the html
  source truncates the matched text to 100 characters.
- Regex execution wraps in try/catch. A bad pattern disables that one rule
  and reports a warning. One broken fingerprint never kills a scan.
- `detect(bundle, fingerprints) -> Detection[]` is a pure function: no
  state, no I/O, deterministic.

## 6. Collector Error Handling

`collect-http` returns a typed result, never a throw across the package
boundary:

- fetch failure, timeout (default 10 s), or non-HTML response → typed error
  result with a reason code
- redirects are followed; the final URL is recorded in the bundle

## 7. Testing and Quality

- Unit tests for the matcher: confidence math, version capture,
  implies/excludes, missing fields, broken-regex isolation. Bun test runner.
- Fixture tests per fingerprint. A fixture is a saved `SignalBundle` JSON in
  `fixtures/<slug>/` with an `expected.json` beside it. Positive fixtures
  must detect the technology; negative fixtures must not. CI fails when a
  fingerprint has no positive fixture.
- The full fixture set doubles as a false-positive regression suite: every
  fingerprint runs against every fixture.
- `bun run capture <url>` records a live site into a fixture file, so a
  contributor adds a fixture in one command.
- CI on every pull request: schema validation, regex lint, compile, full
  test suite.

Initial coverage target: ~100 technologies from IDEA.md §16 (frameworks,
CMS, commerce, analytics, infrastructure, JS libraries, payments).

## 8. Non-Goals (This Phase)

- No DNS, TLS, robots.txt, or known-path probing. The schema can grow these
  sources later.
- No crawling, caching, or persistence. One URL in, one result out.
- No CLI binary, extension, or MCP server. Each is its own later spec.
- No hosted API. The private backend is a separate repo and a separate
  design.
