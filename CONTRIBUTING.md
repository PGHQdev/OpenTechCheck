# Contributing a fingerprint

1. Create `packages/fingerprints/src/registry/<category>/<slug>.yaml`.
   Categories: see `schemas/categories.json`. Schema: `schemas/fingerprint.schema.json`.
2. `bun test` runs schema validation, regex lint, compile, and unit tests.
   The fixture suite (every fingerprint against every captured site) runs
   in CI. Captured fixtures are kept in a private repository.
3. Open a pull request. List one to three public sites that use the
   technology. A maintainer captures fixtures from them and runs the full
   suite before merge.

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
