import { h, render as renderPreact } from 'preact'
import { html, render as renderLit } from 'lit'
import Alpine from 'alpinejs'
import 'svelte/internal/disclose-version'

// Real minified production packages, deliberately without public framework
// globals, Alpine markup, or Lit's optional version arrays as fallback signals.
renderPreact(h('button', {}, 'Preact mounted'), document.getElementById('preact-fixture'))
Alpine.addScopeToNode(document.getElementById('alpine-fixture'), { ready: true })
const shadow = document.getElementById('lit-fixture').attachShadow({ mode: 'open' })
const nested = document.createElement('div')
shadow.append(nested)
renderLit(html`<p>Lit mounted</p>`, nested.attachShadow({ mode: 'open' }))
delete window.litHtmlVersions
delete window.litElementVersions
