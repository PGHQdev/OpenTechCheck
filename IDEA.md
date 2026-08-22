# OpenTechCheck

> Open-source website technology detection, with affordable private APIs for teams and enterprises.

## 1. Idea

**OpenTechCheck** is an open-source alternative to Wappalyzer for detecting the technologies used by websites.

The core detection engine and end-user clients are open source:

- Browser extension
- CLI
- MCP server
- Core fingerprinting/detection library

A hosted **OpenTechCheck API** is offered as a paid commercial service for companies that need scale, reliability, enrichment, monitoring, and managed infrastructure.

The goal is simple:

> Make website technology detection transparent, extensible, developer-friendly, and cheaper to use at scale.

---

## 2. Problem

Website technology detection is useful for:

- developers
- security researchers
- sales teams
- market researchers
- agencies
- competitive intelligence teams
- data enrichment companies
- AI agents

Existing products work well, but often have one or more limitations:

- proprietary detection logic
- limited transparency
- expensive API access at scale
- weak self-hosting options
- difficult community contribution
- limited developer tooling
- vendor lock-in

OpenTechCheck should provide a strong open-source foundation while offering a managed commercial service for organizations that prefer not to operate it themselves.

---

## 3. Product Principles

### Open by default

The detection engine, fingerprints, schemas, and local clients should be public and auditable.

### Useful without an account

A developer should be able to install the extension or CLI and detect technologies without creating an account.

### API as convenience, not lock-in

The hosted API should sell infrastructure, scale, reliability, historical data, enrichment, and operational convenience—not access to a deliberately crippled core engine.

### Community-extensible

Adding or improving a technology fingerprint should be straightforward through pull requests.

### Evidence-based detection

Detections should expose why a technology was identified where practical.

Example:

```json
{
  "technology": "Next.js",
  "confidence": 100,
  "evidence": [
    {
      "source": "html",
      "pattern": "__NEXT_DATA__"
    }
  ]
}
```

### Affordable at scale

The commercial API should aim to be materially cheaper than major incumbents while remaining sustainable.

---

## 4. Open-Source Products

### Browser Extension

A Chrome/Chromium and Firefox extension that detects technologies on the current page.

Possible capabilities:

- technology categories
- technology versions where detectable
- confidence scores
- detection evidence
- links to technology websites
- export as JSON
- copy stack summary
- local-only detection mode
- optional API-powered enrichment

Example:

```text
example.com

Framework
  Next.js 15

JavaScript
  React

Analytics
  Google Analytics

CDN
  Cloudflare

Hosting
  Vercel
```

---

### CLI

A command-line client for developers, scripts, CI, and research.

```bash
opentechcheck https://example.com
```

Possible output formats:

```bash
opentechcheck https://example.com --json
opentechcheck https://example.com --yaml
opentechcheck https://example.com --format table
```

Batch usage:

```bash
opentechcheck scan domains.txt
```

Potential modes:

- local browser-based scan
- lightweight HTTP scan
- remote API scan

---

### MCP Server

An MCP server exposing website technology intelligence to AI agents.

Example tools:

```text
detect_technologies(url)
compare_technology_stacks(urls)
find_technology_evidence(url)
lookup_technology(name)
```

Future hosted tools could include:

```text
find_websites_using(technology)
get_technology_history(domain)
monitor_domain_stack(domain)
```

This would make OpenTechCheck directly usable by AI coding assistants, research agents, CRM agents, and competitive-intelligence workflows.

---

### Core Detection Library

A reusable engine responsible for applying fingerprints to collected website signals.

Conceptually:

```text
Website
   |
   v
Signal collection
   |
   +-- HTML
   +-- DOM
   +-- JavaScript
   +-- scripts
   +-- cookies
   +-- headers
   +-- meta tags
   +-- DNS
   +-- robots.txt
   +-- known URLs
   |
   v
Fingerprint engine
   |
   v
Technology detections
```

Possible package structure:

```text
@opentechcheck/core
@opentechcheck/fingerprints
@opentechcheck/browser
@opentechcheck/cli
@opentechcheck/mcp
```

---

## 5. Fingerprint Registry

Technology fingerprints should live in a public repository.

Example:

```yaml
name: WordPress
category: cms
website: https://wordpress.org

detect:
  html:
    - 'wp-content'
    - 'wp-includes'

  meta:
    generator:
      - 'WordPress(?:\\s([\\d.]+))?'

  scripts:
    - '/wp-includes/'

implies:
  - PHP
```

The exact schema can evolve, but it should prioritize:

- readability
- version detection
- confidence
- evidence
- inheritance
- implied technologies
- exclusions
- test fixtures

Every fingerprint should ideally include automated tests against known examples.

---

## 6. Detection Sources

OpenTechCheck could inspect:

- HTML
- DOM nodes
- CSS selectors
- JavaScript globals
- script URLs
- stylesheet URLs
- meta tags
- cookies
- HTTP response headers
- request/response patterns
- XHR/fetch endpoints
- DNS records
- TLS metadata
- `robots.txt`
- known paths
- redirects
- URL patterns

Not every client needs every detector.

For example, the extension can inspect browser runtime state while a lightweight CLI scan may only inspect HTTP-visible signals.

---

## 7. Confidence and Evidence

A major differentiator should be explainability.

Instead of returning only:

```json
{
  "technology": "Shopify"
}
```

OpenTechCheck should be able to return:

```json
{
  "technology": "Shopify",
  "confidence": 100,
  "version": null,
  "evidence": [
    {
      "source": "script",
      "match": "cdn.shopify.com"
    },
    {
      "source": "html",
      "match": "Shopify.theme"
    }
  ]
}
```

This helps users:

- verify detections
- debug false positives
- improve fingerprints
- understand confidence
- contribute fixes

---

## 8. Hosted Private API

The commercial product would provide a managed API built on top of the open-source engine.

Example:

```http
GET /v1/detect?url=https://example.com
```

Possible response:

```json
{
  "url": "https://example.com",
  "technologies": [
    {
      "name": "Next.js",
      "category": "web-framework",
      "confidence": 100
    },
    {
      "name": "Cloudflare",
      "category": "cdn",
      "confidence": 100
    }
  ]
}
```

### Paid API advantages

The paid service can add value through infrastructure rather than closed detection logic:

- managed browser fleet
- proxy rotation
- anti-bot handling
- high concurrency
- distributed crawling
- caching
- retries
- rate limiting
- historical observations
- scheduled rescans
- domain monitoring
- bulk jobs
- webhooks
- organization accounts
- audit logs
- SLA
- dedicated capacity
- regional execution
- data retention controls

---

## 9. Enterprise Offering

Potential enterprise features:

- private API endpoints
- dedicated workers
- VPC/private networking
- SSO/SAML
- RBAC
- audit logs
- custom retention policies
- higher rate limits
- custom fingerprint packs
- private technology fingerprints
- priority support
- SLAs
- on-premise or private-cloud deployment
- large bulk datasets

Enterprise customers should be paying for operational guarantees and private capabilities, not for basic access to the detection engine.

---

## 10. API Pricing Direction

OpenTechCheck should compete strongly on price.

Possible principles:

- generous free developer tier
- usage-based billing
- simple pricing
- no opaque credit system
- volume discounts
- predictable enterprise contracts

Example structure:

| Tier | Purpose |
|---|---|
| Free | development and small projects |
| Developer | small production workloads |
| Growth | larger API workloads |
| Enterprise | high volume, SLA, private infrastructure |

Pricing should be benchmarked against Wappalyzer and other technology-detection APIs before launch.

The target positioning:

> Comparable core detection utility at a substantially lower API cost, with an open-source engine underneath.

---

## 11. Open Source vs Private

A clear boundary is important.

### Open source

- core fingerprint engine
- public fingerprint registry
- browser extension
- CLI
- MCP server
- schemas
- local scanners
- documentation
- test suite
- SDKs

### Commercial/private

- hosted scanning infrastructure
- large-scale crawling
- historical database
- cached global results
- bulk datasets
- enrichment data
- monitoring
- enterprise administration
- SLAs
- private deployment tooling
- managed anti-bot infrastructure

This model gives developers a genuinely useful open product while preserving a defensible commercial offering.

---

## 12. Potential Repository Structure

```text
opentechcheck/
├── packages/
│   ├── core/
│   ├── fingerprints/
│   ├── browser/
│   ├── cli/
│   └── mcp/
│
├── apps/
│   └── extension/
│
├── schemas/
├── fixtures/
├── docs/
├── tests/
└── README.md
```

The hosted API may live in a separate private repository.

---

## 13. Licensing

Possible approach:

- **Apache-2.0** for the open-source engine and clients
- separate commercial license for proprietary hosted infrastructure

Apache-2.0 is attractive because it is permissive and includes an explicit patent grant.

A more restrictive license should only be considered if preventing hosted competitors becomes strategically important. That would weaken the simplicity of the "open-source alternative" positioning.

---

## 14. Competitive Positioning

OpenTechCheck should not try to win merely by copying Wappalyzer.

Potential differentiators:

### 1. Open fingerprints

Anyone can inspect how technologies are detected.

### 2. Explainable results

Every detection can expose evidence and confidence.

### 3. Better developer experience

First-class CLI, libraries, JSON schemas, SDKs, and MCP.

### 4. Local-first

Users can scan without sending every visited domain to a third-party API.

### 5. Community-maintained technology registry

Technology vendors and developers can submit fingerprints themselves.

### 6. Lower-cost hosted API

Open source keeps the core accessible; the business competes on operational quality and pricing.

### 7. AI-native interface

MCP makes website technology intelligence directly usable by agents.

---

## 15. Initial MVP

The first version should stay narrow.

### Phase 1 — Detection Engine

- fingerprint schema
- HTML detection
- script detection
- meta-tag detection
- header detection
- cookie detection
- confidence scoring
- evidence output
- test framework

Target: reliable detection of roughly 100 high-value technologies.

### Phase 2 — Browser Extension

- detect current page
- categorized results
- version display
- evidence view
- local-only operation

### Phase 3 — CLI

```bash
opentechcheck https://example.com
```

Support JSON output from day one.

### Phase 4 — MCP

Expose the local detector through MCP.

### Phase 5 — Hosted API

Launch managed scanning after the local engine has proven useful.

---

## 16. Early Technology Coverage

Prioritize technologies people commonly care about rather than maximizing raw count.

Examples:

### Frameworks

- React
- Next.js
- Vue
- Nuxt
- Angular
- Svelte
- SvelteKit

### CMS

- WordPress
- Drupal
- Joomla
- Ghost
- Contentful
- Sanity

### Commerce

- Shopify
- WooCommerce
- Magento
- BigCommerce

### Analytics

- Google Analytics
- Google Tag Manager
- Plausible
- Matomo
- Segment

### Infrastructure

- Cloudflare
- Vercel
- Netlify
- AWS
- Fastly

### JavaScript libraries

- jQuery
- Alpine.js
- HTMX

### Payments

- Stripe
- PayPal
- Adyen

---

## 17. Quality Strategy

Detection quality will determine whether the project succeeds.

Every fingerprint should have:

- positive fixtures
- negative fixtures
- version tests where applicable
- false-positive regression tests

Useful metrics:

```text
precision
recall
false-positive rate
version-detection accuracy
scan latency
```

A smaller registry with high-quality detections is preferable to thousands of unreliable fingerprints.

---

## 18. Community Model

Contributing a technology should be intentionally easy.

Possible flow:

```text
1. Add fingerprint
2. Add test fixture
3. Run test command
4. Open pull request
5. CI validates fingerprint
6. Maintainer review
7. Merge
```

Technology vendors could also maintain their own official fingerprints.

A public contribution guide should specify:

- fingerprint format
- evidence requirements
- version rules
- confidence rules
- testing requirements

---

## 19. Privacy

The browser extension should have a strong privacy posture.

Default behavior should ideally be:

```text
page -> local detector -> result
```

not:

```text
page -> OpenTechCheck servers -> result
```

Remote API features should be explicit.

This creates a meaningful distinction from products that depend heavily on centralized lookup services.

---

## 20. Long-Term Opportunities

Once detection is reliable, OpenTechCheck could expand into:

- technology adoption trends
- technology migration tracking
- competitor monitoring
- domain technology history
- sales prospecting datasets
- market-share analysis
- security exposure research
- abandoned/deprecated technology detection
- browser automation APIs
- company enrichment
- datasets for AI agents
- technology-change webhooks

Example:

```text
"Notify me when example.com migrates away from Shopify."
```

or:

```text
"Find companies using Magento but not Cloudflare."
```

These capabilities can become valuable commercial products without closing the core detector.

---

## 21. Brand

**Name:** OpenTechCheck

Possible tagline:

> See what websites are built with.

Alternative technical tagline:

> Open-source technology fingerprinting for the web.

Potential naming:

```text
GitHub:     opentechcheck/opentechcheck
npm:        @opentechcheck/core
CLI:        opentechcheck
MCP:        @opentechcheck/mcp
Extension:  OpenTechCheck
API:        api.opentechcheck.com
```

---

## 22. North Star

The ideal outcome is:

> A developer can inspect, understand, extend, and run the same core technology-detection engine locally for free, while companies can pay OpenTechCheck for fast, reliable, large-scale managed access.

That gives the project both a credible open-source identity and a sustainable commercial path.
