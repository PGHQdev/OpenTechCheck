# Framework runtime probes

Probes run locally in the page's main JavaScript world. They read framework markers,
not component state, and export only detection flags or exposed version strings.
The YAML registry must include each `$probe.*` key so the content script allowlist
can receive it. Run `bun run compile` from the repo root after editing fingerprints.

## Signals

| Framework | Runtime evidence | Version behavior |
| --- | --- | --- |
| React | Own fiber/container properties on mounted DOM nodes | Uses an exposed React.version only |
| Vue | Own __vue_app__/__vue__ objects; __VUE__ flag | Reads the mounted Vue app's version |
| Angular | Numeric/array __ngContext__; ng-version on elements | Uses ng-version if present |
| Alpine | Nonempty _x_dataStack array on a mounted node | Uses exposed Alpine.version only |
| Lit | _$litPart$ ChildPart on a render container or render-before comment; litHtmlVersions/litElementVersions | Presence only: constituent package versions are not the umbrella Lit version |
| Preact | Root vnode with corroborating children, vnode ID, props, and type fields | Presence only |
| Svelte | Real Set of versions at __svelte.v | Reports disclosed major; multiple versions leave version unknown |

These are internal signals, so package upgrades can require changes. Solid and
Ember retain their existing fingerprints; this change does not infer their runtime
from generic DOM properties. Closed shadow roots and frames are outside this pass.
Svelte builds can disable version disclosure and may expose no dependable runtime marker.

Primary references checked when implementing:

- [Angular context attachment](https://github.com/angular/angular/blob/main/packages/core/src/render3/context_discovery.ts)
- [Alpine scope attachment](https://github.com/alpinejs/alpine/blob/main/packages/alpinejs/src/scope.js)
- [Lit rendering and parts](https://github.com/lit/lit/blob/main/packages/lit-html/src/lit-html.ts)
- [Preact rendering](https://github.com/preactjs/preact/blob/main/src/render.js) and [property mangling](https://github.com/preactjs/preact/blob/main/mangle.json)
- [Svelte version disclosure](https://github.com/sveltejs/svelte/blob/main/packages/svelte/src/internal/disclose-version.js)

## Traversal and lifecycle

Common application mounts are checked first. A TreeWalker then visits elements and
comments throughout the document and reachable open shadow roots. It does not
allocate a full-document NodeList or stop at an arbitrary DOM index. The scan yields
after 250 nodes or approximately 4 ms of work. A 2-second wall-clock budget bounds
pathological pages; throttled background tabs may also hit that budget. Positive
evidence is retained, but an incomplete or aborted pass cannot qualify a page for
an automatic empty-coverage report.

Scans run sequentially, keeping only the newest waiting request. Results retain
their original request IDs. Navigation cancels the old pass. Discovered open shadow
roots are observed for later changes, which schedule fresh scans. Mutations during
a pass invalidate its quiet-page status or completeness before automatic reporting.
New shadow roots attached without a light-DOM change are discovered on the next
scheduled scan or popup refresh. Framework data properties are inspected with descriptors, avoiding
invocation of their getters or application methods.

## Verification

`bun test packages/extension/test/probes.test.ts packages/extension/test/probe-queue.test.ts`
checks deep DOM, nested open shadows, shaped markers and lookalikes, mixed frameworks,
versions, getters, yielding, timeout, and request/navigation ordering.

`bun test packages/extension/e2e` also bundles the pinned development dependencies
Preact 10.29.8, Lit 3.3.3, Alpine 3.17.4, and the installed Svelte disclosure module
into a minified browser fixture. Mounts sit after 6,000 unrelated elements, with Lit
inside nested shadow DOM and public version arrays removed. These libraries are test
inputs only; they are not imported by extension production entry points.
