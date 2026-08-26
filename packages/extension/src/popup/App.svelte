<script lang="ts">
  import { ext } from '../shared/ext'
  import { grade, groupByCategory, stackSummary, exportPayload, websiteOf, codeOf, categoryShort, categoryLabel } from './format'
  import type { TabResult } from '../shared/protocol'
  import { ICON_SLUGS } from 'virtual:lists'

  let state = $state<'scanning' | 'ready' | 'uninspectable'>('scanning')
  let result = $state<TabResult | null>(null)
  let hostname = $state('')
  let expanded = $state<string | null>(null)

  const icons = new Set(ICON_SLUGS)
  // Deterministic tile color for technologies without a fetched favicon.
  const MONO_COLORS = ['#2427f0', '#b04c22', '#1d6b2a', '#7952b3', '#0769ad', '#a21111']
  const monoColor = (slug: string) => {
    let h = 0
    for (const c of slug) h = (h * 31 + c.charCodeAt(0)) | 0
    return MONO_COLORS[Math.abs(h) % MONO_COLORS.length]
  }
  const monogram = (name: string) => name.replace(/[^A-Za-z0-9 ]/g, '').slice(0, 2)

  const poll = async (attempt = 0) => {
    result = (await ext.runtime.sendMessage({ type: 'get-result' })) as TabResult | null
    // The background may still be assembling signals right after navigation;
    // give it a moment before declaring the page empty.
    if (!result && attempt < 4) { setTimeout(() => poll(attempt + 1), 700); return }
    state = 'ready'
  }
  const load = async () => {
    const [tab] = await ext.tabs.query({ active: true, currentWindow: true })
    if (!tab?.url || !/^https?:/.test(tab.url)) { state = 'uninspectable'; return }
    hostname = new URL(tab.url).hostname
    poll()
  }
  load()

  const detections = $derived(result?.detections ?? [])
  const groups = $derived(groupByCategory(detections))
  // Continuous index numbers across the grouped list, keyed by slug.
  const indexOf = $derived(new Map(groups.flatMap((g) => g.items).map((d, i) => [d.slug, String(i + 1).padStart(3, '0')])))

  const copyStack = () => navigator.clipboard.writeText(stackSummary(detections))
  const exportJson = () => {
    if (!result) return
    const url = URL.createObjectURL(new Blob([exportPayload(result)], { type: 'application/json' }))
    const a = document.createElement('a')
    a.href = url
    a.download = `opentechcheck-${new URL(result.url).hostname}.json`
    a.click()
    URL.revokeObjectURL(url)
  }
  const openSite = (slug: string, e: MouseEvent) => {
    e.stopPropagation()
    const url = websiteOf(slug)
    if (url) ext.tabs.create({ url })
  }
  const isImplied = (slug: string) => detections.find((d) => d.slug === slug)?.evidence.every((e) => e.source === 'implied') ?? false
</script>

<main>
  <header>
    <span class="logo">
      <svg width="17" height="17" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
        <rect x="3" y="4.5" width="14" height="4" rx="2" fill="#fff" />
        <rect x="7" y="10" width="14" height="4" rx="2" fill="#fff" opacity=".8" />
        <rect x="3" y="15.5" width="14" height="4" rx="2" fill="#fff" opacity=".55" />
      </svg>
    </span>
    <span class="brand">OpenTechCheck</span>
    {#if state === 'ready' && hostname}<span class="hostname">{hostname}</span>{/if}
    {#if state === 'ready' && detections.length > 0}<span class="count">{detections.length} FOUND</span>{/if}
    <span class="tagline">LOCAL · NO REQUESTS</span>
  </header>

  {#if state === 'scanning'}
    <div class="state">
      <span class="host">{hostname}</span>
      <div class="bars"><i class="on"></i><i class="on" style="animation-delay:.2s"></i><i></i><i></i><i></i></div>
      <h2>Reading this page…</h2>
      <p>Analyzing local signals</p>
    </div>
  {:else if state === 'uninspectable'}
    <div class="state">
      <span class="glyph">⌀</span>
      <h2>This page can't be inspected.</h2>
      <p>Browser pages and the extension store don't expose their signals. Open a regular website and try again.</p>
    </div>
  {:else if detections.length === 0}
    <div class="state">
      <span class="glyph">◎</span>
      <h2>No technologies detected.</h2>
      <p>This page may use technologies outside the current fingerprint registry.</p>
      <a href="https://github.com/PGHQdev/OpenTechCheck/blob/main/CONTRIBUTING.md" target="_blank" rel="noreferrer">Contribute a fingerprint ↗</a>
    </div>
  {:else}
    <div class="results">
      <div class="cols">
        {#each groups as group}
          <section>
            <div class="cat">{categoryLabel(group.category)}{#if categoryShort(group.category) !== categoryLabel(group.category).toUpperCase()}<span class="code">{categoryShort(group.category)}</span>{/if}</div>
            {#each group.items as det}
              <button class="row" onclick={() => (expanded = expanded === det.slug ? null : det.slug)}>
                {#if icons.has(det.slug)}
                  <span class="tile"><img src={`icons/${det.slug}.png`} alt="" /></span>
                {:else}
                  <span class="tile mono" style={`background:${monoColor(det.slug)}`}>{monogram(det.name)}</span>
                {/if}
                <span class="no">{isImplied(det.slug) ? '–' : indexOf.get(det.slug)}</span>
                <span class="rowmain">
                  <span class="name">{det.name}</span>
                  {#if det.version}<span class="version">{det.version}</span>{/if}
                  {#if isImplied(det.slug)}
                    <span class="chip implied">IMPLIED</span>
                  {:else}
                    <span class="chip {grade(det.confidence).toLowerCase()}">{grade(det.confidence)}</span>
                  {/if}
                  <span class="ext" role="link" tabindex="-1" title="Open website" onclick={(e) => openSite(det.slug, e)} onkeydown={() => {}}>↗</span>
                </span>
              </button>
              {#if expanded === det.slug}
                <div class="evidence">
                  <div class="evhead"><span class="l">EVIDENCE · {codeOf(det.slug)}</span><span class="r">LOCAL</span></div>
                  {#each det.evidence as ev}
                    <div class="evline"><b>{ev.source}{ev.key ? ` · ${ev.key}` : ''}</b> {ev.match || ev.pattern || 'present'}</div>
                  {/each}
                </div>
              {/if}
            {/each}
          </section>
        {/each}
      </div>
    </div>
  {/if}

  <footer>
    <button class="btn primary" onclick={copyStack} disabled={detections.length === 0}>Copy stack ⧉</button>
    <button class="btn secondary" onclick={exportJson} disabled={detections.length === 0}>Export JSON ↓</button>
    <span class="tagline">LOCAL · NO REQUESTS</span>
  </footer>
</main>
