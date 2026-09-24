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

## Releasing

Package versions track the git release tag. When cutting a release:

1. Bump `"version"` in every versioned package (`core`, `fingerprints`,
   `collect-http`, `site`) and in `packages/extension/manifest/base.json`
   to the new tag number.
2. Commit, tag (`vX.Y.Z`, annotated), and push.

`extension` and `reporting` are not published; only the extension
manifest version is bumped.
