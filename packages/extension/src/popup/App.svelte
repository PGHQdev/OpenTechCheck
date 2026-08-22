<script lang="ts">
  import { ext } from '../shared/ext'
  import { grade, groupByCategory, stackSummary, exportPayload, websiteOf } from './format'
  import type { TabResult } from '../shared/protocol'

  let state = $state<'loading' | 'ready' | 'uninspectable'>('loading')
  let result = $state<TabResult | null>(null)
  let expanded = $state<string | null>(null)

  const load = async () => {
    const [tab] = await ext.tabs.query({ active: true, currentWindow: true })
    if (!tab?.url || !/^https?:/.test(tab.url)) { state = 'uninspectable'; return }
    result = (await ext.runtime.sendMessage({ type: 'get-result' })) as TabResult | null
    state = 'ready'
  }
  load()

  const copyStack = () => navigator.clipboard.writeText(stackSummary(result?.detections ?? []))
  const exportJson = () => {
    if (!result) return
    const url = URL.createObjectURL(new Blob([exportPayload(result)], { type: 'application/json' }))
    const a = document.createElement('a')
    a.href = url
    a.download = `opentechcheck-${new URL(result.url).hostname}.json`
    a.click()
    URL.revokeObjectURL(url)
  }
</script>

<main class="w-96 p-3 text-sm">
  {#if state === 'loading'}
    <p class="text-gray-500">Detecting…</p>
  {:else if state === 'uninspectable'}
    <p class="text-gray-500">This page cannot be inspected.</p>
  {:else if !result || result.detections.length === 0}
    <p class="text-gray-500">No technologies detected.</p>
  {:else}
    {#each groupByCategory(result.detections) as group}
      <section class="mb-3">
        <h2 class="mb-1 font-semibold uppercase tracking-wide text-xs text-gray-400">{group.category}</h2>
        {#each group.items as det}
          <button
            class="flex w-full items-center justify-between rounded px-1 py-0.5 text-left hover:bg-gray-100"
            onclick={() => (expanded = expanded === det.slug ? null : det.slug)}
          >
            <span>
              {det.name}
              {#if det.version}<span class="text-gray-500">{det.version}</span>{/if}
            </span>
            <span class="rounded bg-gray-200 px-1 font-mono text-xs">{grade(det.confidence)}</span>
          </button>
          {#if expanded === det.slug}
            <div class="mb-1 ml-2 border-l pl-2 text-xs text-gray-600">
              {#each det.evidence as ev}
                <div><span class="font-mono">{ev.source}{ev.key ? `:${ev.key}` : ''}</span> — {ev.match || ev.pattern}</div>
              {/each}
              <a class="text-blue-600" href={websiteOf(det.slug) ?? '#'} target="_blank" rel="noreferrer">website</a>
            </div>
          {/if}
        {/each}
      </section>
    {/each}
    <footer class="flex gap-2 border-t pt-2">
      <button class="rounded bg-gray-800 px-2 py-1 text-white" onclick={copyStack}>Copy stack</button>
      <button class="rounded border px-2 py-1" onclick={exportJson}>Export JSON</button>
    </footer>
  {/if}
</main>
