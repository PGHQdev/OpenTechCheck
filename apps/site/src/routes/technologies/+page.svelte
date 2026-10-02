<script lang="ts">
  import catalog from '../../registry-catalog.json'
  import { categoryLabel, groupByCategory, type Tech } from '$lib/catalog'

  const rules = 'https://github.com/PGHQdev/OpenTechCheck/blob/main/packages/fingerprints/src/registry'
  const groups = groupByCategory(catalog as Tech[])
  const countLabel = catalog.length.toLocaleString('en-US')
  const filterScript = `<script>(() => {
  const input = document.getElementById('tech-filter')
  const status = document.getElementById('tech-status')
  const all = status.textContent
  const groups = [...document.querySelectorAll('.tgroup')].map((group) => ({
    group,
    jump: document.querySelector('.jump a[href="#' + group.id + '"]'),
    items: [...group.querySelectorAll('li')].map((li) => [li, li.firstElementChild.textContent.toLowerCase()]),
  }))
  input.closest('.filter').hidden = false
  input.addEventListener('input', () => {
    const term = input.value.trim().toLowerCase()
    let shown = 0
    for (const { group, jump, items } of groups) {
      let count = 0
      for (const [li, name] of items) {
        const match = !term || name.includes(term)
        li.hidden = !match
        if (match) count++
      }
      group.hidden = count === 0
      jump.parentElement.hidden = count === 0
      shown += count
    }
    status.textContent = term ? (shown === 0 ? 'No technologies match.' : shown.toLocaleString('en-US') + ' of ' + all) : all
  })
})()<\/script>`
</script>

<svelte:head>
  <title>Supported technologies · OpenTechCheck</title>
  <meta name="description" content={`The ${countLabel} technologies OpenTechCheck detects, grouped by category, each with its open detection rule.`} />
</svelte:head>

<main class="catalog wrap">
  <a class="back" href="/">← OpenTechCheck home</a>
  <h1>Supported technologies</h1>
  <p class="intro">OpenTechCheck detects {countLabel} technologies. Each one has a readable detection rule on GitHub.</p>

  <div class="filter" hidden>
    <label for="tech-filter">Filter by name</label>
    <input id="tech-filter" type="search" autocomplete="off" spellcheck="false" placeholder="e.g. WordPress" />
  </div>
  <p id="tech-status" class="status" aria-live="polite">{countLabel} technologies</p>

  <nav class="jump" aria-label="Categories">
    <ul>
      {#each groups as group}
        <li><a href={`#cat-${group.category}`}>{categoryLabel(group.category)} <span>{group.items.length}</span></a></li>
      {/each}
    </ul>
  </nav>

  {#each groups as group}
    <section class="tgroup" id={`cat-${group.category}`}>
      <h2>{categoryLabel(group.category)} <span>{group.items.length}</span></h2>
      <ul>
        {#each group.items as tech}
          <li>{#if tech.website}<a href={tech.website} target="_blank" rel="noopener">{tech.name}</a>{:else}<span>{tech.name}</span>{/if}
            <a class="rule" href={`${rules}/${tech.path}`} target="_blank" rel="noopener">View rule</a></li>
        {/each}
      </ul>
    </section>
  {/each}
</main>

{@html filterScript}

<style>
  .catalog { padding-top: 48px; padding-bottom: 80px; }
  .catalog :global([hidden]) { display: none !important; }
  .back { font-size: 14px; font-weight: 600; color: var(--blue); text-decoration: none; }
  .back:hover { text-decoration: underline; }
  h1 { font-family: var(--display); font-weight: 800; font-size: clamp(34px, 5vw, 48px); line-height: 1.05; letter-spacing: -0.035em; margin: 14px 0 0; }
  .intro { margin-top: 14px; font-size: 17px; color: var(--dim); max-width: 56ch; }

  .filter { margin-top: 28px; max-width: 420px; }
  .filter label { display: block; font-weight: 600; font-size: 14px; margin-bottom: 6px; }
  .filter input {
    width: 100%; font: inherit; font-size: 16px; color: var(--ink);
    background: var(--card); border: 1.5px solid var(--ink); border-radius: 8px; padding: 11px 14px;
  }
  .filter input:focus { outline: 3px solid var(--blue-soft); border-color: var(--blue); }
  .status { margin-top: 12px; font-size: 14px; color: var(--dim); }

  .jump { margin-top: 24px; padding: 16px 0; border-top: 1.5px solid var(--ink); border-bottom: 1px solid var(--line); }
  .jump ul { list-style: none; display: flex; flex-wrap: wrap; gap: 8px; }
  .jump a {
    display: inline-flex; gap: 6px; align-items: baseline; text-decoration: none;
    font-family: var(--mono); font-size: 12px; font-weight: 600; letter-spacing: 0.08em; text-transform: uppercase;
    background: var(--card); border: 1px solid var(--line); border-radius: 6px; padding: 5px 10px;
  }
  .jump a:hover { border-color: var(--blue); color: var(--blue); }
  .jump span, h2 span { font-family: var(--mono); font-size: 12px; font-weight: 400; color: var(--dim); }

  .tgroup { padding-top: 36px; scroll-margin-top: 80px; }
  h2 {
    display: flex; align-items: baseline; gap: 10px;
    font-family: var(--mono); font-size: 13px; font-weight: 600; letter-spacing: 0.12em;
    text-transform: uppercase; color: var(--ink);
    padding-bottom: 8px; border-bottom: 1px solid var(--line);
  }
  .tgroup :global(ul) { list-style: none; display: grid; grid-template-columns: repeat(auto-fill, minmax(230px, 1fr)); column-gap: 24px; margin-top: 8px; }
  .tgroup :global(li) { display: flex; align-items: baseline; justify-content: space-between; gap: 12px; padding: 7px 0; border-bottom: 1px solid var(--line); min-width: 0; }
  .tgroup :global(li > :first-child) { font-size: 15px; overflow-wrap: anywhere; }
  .tgroup :global(li > a:first-child) { text-decoration: none; }
  .tgroup :global(li > a:first-child:hover) { color: var(--blue); text-decoration: underline; }
  .tgroup :global(.rule) { flex: none; font-size: 12.5px; color: var(--blue); }

  @media (max-width: 640px) {
    .catalog { padding-top: 32px; }
    .tgroup { scroll-margin-top: 130px; }
    .tgroup :global(ul) { grid-template-columns: minmax(0, 1fr); }
  }
</style>
