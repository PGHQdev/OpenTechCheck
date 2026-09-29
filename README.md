# OpenTechCheck

> See what websites are built with. Open-source technology fingerprinting for the web.

Detects the technologies behind a website — frameworks, CMS, analytics, CDN, and more —
with confidence scores and the evidence for every detection.

**[Install the Chrome extension](https://chromewebstore.google.com/detail/opentechcheck/ijggpkkfefnlkinbpkkiihiciffpjnab)** · [opentechcheck.com](https://opentechcheck.com)

## Packages

| Package | Purpose |
|---|---|
| `@opentechcheck/core` | Pure detection engine: `detect(bundle, fingerprints)` |
| `@opentechcheck/fingerprints` | Community fingerprint registry (YAML → compiled JSON) |
| `@opentechcheck/collect-http` | Fetch-based signal collector |

## Quick start

Run `bun install && bun run compile` first to build the fingerprint registry that the example imports.

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

## Browser extension

Local-only technology detection for the current page (Chrome ≥ 121, Firefox ≥ 128).

Install from the [Chrome Web Store](https://chromewebstore.google.com/detail/opentechcheck/ijggpkkfefnlkinbpkkiihiciffpjnab), or build from source:

    bun run compile          # refresh the fingerprint registry
    cd packages/extension
    bun run build            # emits dist/chrome and dist/firefox

Load `dist/chrome` via chrome://extensions → "Load unpacked" (enable Developer mode),
or `dist/firefox` via about:debugging → "Load Temporary Add-on". Detection runs
entirely in your browser. Optional reports open the website’s prefilled form;
no report is sent until you submit it.

An optional **Automatically report undetected websites** setting is off by default.
When enabled, completed empty scans can submit only the website domain. Private
browsing and local-network sites are excluded; submissions are deduplicated and capped.
Detection rescans after loading, relevant page changes, and opening the popup.

## Contributing

Add a technology in one YAML file — see [CONTRIBUTING.md](CONTRIBUTING.md).

## License

Apache-2.0
