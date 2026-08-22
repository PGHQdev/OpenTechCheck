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
