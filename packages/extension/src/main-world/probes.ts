const REACT_PREFIXES = ['__reactFiber$', '__reactContainer$', '_reactRootContainer']
const VERSION = /^\d+(?:\.\d+){0,3}(?:-[\w.-]+)?(?:\+[\w.-]+)?$/
const SLICE_NODES = 250
const SLICE_MS = 4
const MAX_SCAN_MS = 2000

export interface ProbeResult { js: Record<string, string>; complete: boolean }
export interface ProbeOptions {
  onShadowRoot?: (root: ShadowRoot) => void
  signal?: AbortSignal
  now?: () => number
  yieldToPage?: () => Promise<void>
}

const object = (value: unknown): value is object => value !== null && (typeof value === 'object' || typeof value === 'function')
// Inspect only data properties; never invoke framework getters or traverse state.
function own(value: unknown, key: string): unknown {
  if (!object(value)) return undefined
  try { return Object.getOwnPropertyDescriptor(value, key)?.value } catch { return undefined }
}
const version = (value: unknown) => typeof value === 'string' && value.length <= 64 && VERSION.test(value) ? value : undefined

function preactRoot(value: unknown): boolean {
  const type = own(value, 'type')
  return object(own(value, 'props')) && (typeof type === 'function' || typeof type === 'string') &&
    ((Array.isArray(own(value, '__k')) && typeof own(value, '__v') === 'number') ||
     (Array.isArray(own(value, '_children')) && typeof own(value, '_original') === 'number'))
}

/** A bounded, yielding traversal of the light DOM and reachable open shadow DOM. */
export async function runProbes(doc: Document, win: unknown, options: ProbeOptions = {}): Promise<ProbeResult> {
  const js: Record<string, string> = {}
  const now = options.now ?? (() => performance.now())
  const yieldToPage = options.yieldToPage ?? (() => new Promise<void>((resolve) => setTimeout(resolve, 0)))
  const start = now()
  let sliceStart = start
  let sliceNodes = 0
  let complete = true
  const roots: Node[] = [doc]
  const visited = new WeakSet<Node>()
  const versions = new Map<string, Set<string>>()
  const mark = (name: string, candidate?: unknown) => {
    const key = `$probe.${name}`
    const parsed = version(candidate)
    if (parsed) {
      const values = versions.get(key) ?? new Set<string>()
      values.add(parsed); versions.set(key, values)
      js[key] = values.size === 1 ? parsed : 'detected'
    } else js[key] ??= 'detected'
  }
  const expired = () => options.signal?.aborted || now() - start >= MAX_SCAN_MS

  function globals() {
    if (own(win, '__VUE__') === true) mark('vue')
    for (const key of ['litHtmlVersions', 'litElementVersions']) {
      const values = own(win, key)
      if (Array.isArray(values)) {
        for (let i = 0; i < Math.min(values.length, 8); i++) {
          if (version(own(values, String(i)))) { mark('lit'); break }
        }
      }
    }
    try {
      const disclosed = own(own(win, '__svelte'), 'v')
      // Use the built-in iterator, not methods supplied by the page object.
      const iterator = Set.prototype.values.call(disclosed) as IterableIterator<unknown>
      let count = 0
      for (const value of iterator) {
        if (++count > 8) break
        if (version(value)) mark('svelte', value)
      }
    } catch { /* disclosure is optional, or not a real Set */ }
  }

  function inspect(node: Node) {
    if (visited.has(node)) return
    visited.add(node)
    try {
      const keys = Object.getOwnPropertyNames(node)
      if (keys.some((key) => REACT_PREFIXES.some((prefix) => key.startsWith(prefix)) && object(own(node, key)))) {
        mark('react', own(own(win, 'React'), 'version'))
      }
      const vueApp = own(node, '__vue_app__')
      if (object(vueApp) || object(own(node, '__vue__'))) mark('vue', own(vueApp, 'version'))
      const angular = own(node, '__ngContext__')
      if ((typeof angular === 'number' && Number.isInteger(angular) && angular >= 0) || Array.isArray(angular)) mark('angular')
      const alpine = own(node, '_x_dataStack')
      if (Array.isArray(alpine) && alpine.length > 0) mark('alpinejs', own(own(win, 'Alpine'), 'version'))
      if (own(own(node, '_$litPart$'), 'type') === 2) mark('lit')
      if (preactRoot(own(node, '__k')) || preactRoot(own(node, '_children'))) mark('preact')
      if (node.nodeType === 1) {
        const el = node as Element
        const angularVersion = el.getAttribute('ng-version')
        if (version(angularVersion)) mark('angular', angularVersion)
        if (el.shadowRoot) { options.onShadowRoot?.(el.shadowRoot); roots.push(el.shadowRoot); inspect(el.shadowRoot) }
      }
    } catch { complete = false }
  }

  try {
    if (expired()) return { js, complete: false }
    globals()
    // Fast checks for common mounts regardless of their position in the document.
    for (const node of [doc.documentElement, doc.body, ...['app', 'root', '__next', '__nuxt'].map((id) => doc.getElementById(id))]) {
      if (node) inspect(node)
    }
    for (let rootIndex = 0; rootIndex < roots.length; rootIndex++) {
      const root = roots[rootIndex]!
      inspect(root)
      // Comments matter: Lit's renderBefore option attaches its root part there.
      const walker = doc.createTreeWalker(root, 1 | 128)
      let node: Node | null
      while ((node = walker.nextNode())) {
        if (expired()) return { js, complete: false }
        inspect(node)
        if (++sliceNodes >= SLICE_NODES || now() - sliceStart >= SLICE_MS) {
          await yieldToPage()
          sliceNodes = 0; sliceStart = now()
        }
      }
    }
    globals()
    return { js, complete: complete && !expired() }
  } catch { return { js, complete: false } }
}
