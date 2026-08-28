<script lang="ts">
  const demo = [
    { cat: 'Web framework', items: [{ icon: 'ruby-on-rails', name: 'Ruby on Rails', grade: 'A', ev: 'meta · csrf-param' }] },
    { cat: 'UI framework', items: [
      { icon: 'bootstrap', name: 'Bootstrap', version: '3.4.1', grade: 'A' },
      { icon: 'font-awesome', name: 'Font Awesome', grade: 'B' },
    ] },
    { cat: 'JS library', items: [
      { icon: 'jquery', name: 'jQuery', version: '3.7.0', grade: 'A' },
      { icon: 'chartjs', name: 'Chart.js', version: '4.4.0', grade: 'B' },
    ] },
    { cat: 'Server', items: [{ icon: 'nginx', name: 'Nginx', version: '1.18.0', grade: 'A' }] },
    { cat: 'Language', items: [{ icon: 'ruby', name: 'Ruby', implied: true }] },
  ]
  const wall = [
    'react', 'nextjs', 'vue', 'svelte', 'angular', 'astro', 'remix', 'nuxt',
    'wordpress', 'shopify', 'drupal', 'webflow', 'ghost', 'squarespace', 'wix', 'magento',
    'cloudflare', 'vercel', 'netlify', 'fastly', 'nginx', 'caddy', 'envoy', 'heroku',
    'tailwindcss', 'bootstrap', 'jquery', 'd3', 'htmx', 'gsap', 'threejs', 'laravel',
    'django', 'ruby-on-rails', 'phoenix', 'express', 'php', 'python', 'nodejs', 'stripe',
  ]
  const ticker = 'react 19.2 ● shopify ● rails 8.0 ● cloudflare ● next.js 15.3 ● wordpress 6.7 ● svelte 5 ● laravel 12 ● nginx 1.27 ● astro 5 ● stripe ● django 5.2 ● '
</script>

<svelte:head>
  <title>OpenTechCheck — see what websites are built with</title>
  <meta name="description" content="Open-source technology detection for the web. Every detection backed by evidence, computed entirely in your browser." />
  <meta property="og:title" content="OpenTechCheck" />
  <meta property="og:description" content="The open index of the web's stack. Local, evidence-based technology detection." />
</svelte:head>

<section class="hero">
  <div class="wrap herogrid">
    <div class="herotext">
      <div class="kicker">OPEN SOURCE · LOCAL · EVIDENCE-BASED</div>
      <h1>The open<br />index of the<br /><em>web's stack.</em></h1>
      <p class="sub">
        See what any site is built with — frameworks, CMS, analytics, servers,
        languages. Every detection backed by the evidence that produced it,
        computed entirely in your browser.
      </p>
      <div class="ctas">
        <a class="btn primary" href="https://chromewebstore.google.com/detail/opentechcheck/ijggpkkfefnlkinbpkkiihiciffpjnab" target="_blank" rel="noreferrer">Add to Chrome</a>
        <a class="btn secondary" href="https://github.com/PGHQdev/OpenTechCheck" target="_blank" rel="noreferrer">Read the source ↗</a>
      </div>
      <div class="mono trust">NO ACCOUNT · NO TRACKING · NO CLOUD</div>
    </div>

    <div class="popupmock" aria-hidden="true">
      <div class="pm-head">
        <span class="pm-site mono">yoursite.example</span>
        <span class="pm-count mono">8 FOUND</span>
      </div>
      <div class="pm-body">
        {#each demo as group}
          <div class="pm-cat mono">{group.cat}</div>
          {#each group.items as it}
            <div class="pm-row">
              <span class="pm-tile"><img src={`/icons/${it.icon}.png`} alt="" loading="lazy" /></span>
              <span class="pm-name">{it.name}</span>
              {#if it.version}<span class="pm-ver mono">{it.version}</span>{/if}
              {#if it.implied}
                <span class="pm-chip implied mono">IMPLIED</span>
              {:else}
                <span class="pm-chip {it.grade === 'A' ? 'a' : 'b'} mono">{it.grade}</span>
              {/if}
            </div>
            {#if it.ev}
              <div class="pm-ev mono"><b>EVIDENCE</b> {it.ev}</div>
            {/if}
          {/each}
        {/each}
      </div>
    </div>
  </div>
  <div class="ticker mono" aria-hidden="true"><span>{ticker}{ticker}</span></div>
</section>

<section class="features">
  <div class="wrap fgrid">
    <div class="feat">
      <div class="fno mono">001</div>
      <h3>Proof, not vibes.</h3>
      <p>
        Every detection shows the exact signal that produced it — a header, a
        meta tag, a JavaScript global. Verify any claim yourself; debug false
        positives; trust what you ship in a report.
      </p>
    </div>
    <div class="feat">
      <div class="fno mono">002</div>
      <h3>Your browser. Full stop.</h3>
      <p>
        Detection runs against the page you already loaded. No URL is sent
        anywhere, no account exists, no analytics ride along. The extension
        makes zero network requests — the fonts are bundled.
      </p>
    </div>
    <div class="feat">
      <div class="fno mono">003</div>
      <h3>An open registry.</h3>
      <p>
        Every fingerprint is a readable YAML file, tested against real
        captured sites in CI. Wrong or missing? One pull request fixes it for
        everyone.
      </p>
    </div>
  </div>
</section>

<section class="wall">
  <div class="wrap">
    <div class="kicker">THE REGISTRY</div>
    <h2>155 technologies, filed and fingerprinted.</h2>
    <div class="wallgrid">
      {#each wall as slug}
        <span class="wtile" title={slug}><img src={`/icons/${slug}.png`} alt={slug} loading="lazy" /></span>
      {/each}
      <a class="wtile more mono" href="https://github.com/PGHQdev/OpenTechCheck/tree/main/packages/fingerprints/src/registry" target="_blank" rel="noreferrer">+115</a>
    </div>
  </div>
</section>

<section class="how">
  <div class="wrap">
    <div class="kicker">HOW IT WORKS</div>
    <div class="steps">
      <div class="step">
        <span class="mono sno">01</span>
        <h3>Collect</h3>
        <p>On each page the extension reads local signals: HTML, script URLs, headers, cookies, meta tags, JS globals.</p>
      </div>
      <div class="step">
        <span class="mono sno">02</span>
        <h3>Match</h3>
        <p>Signals run against the open fingerprint registry. Each match carries a confidence grade and its evidence.</p>
      </div>
      <div class="step">
        <span class="mono sno">03</span>
        <h3>Report</h3>
        <p>The stack appears in the popup, grouped and versioned. Copy it as text or export the full evidence as JSON.</p>
      </div>
    </div>
  </div>
</section>

<section class="final">
  <div class="wrap fin">
    <h2>What is <em>your</em> site made of?</h2>
    <a class="btn primary" href="https://chromewebstore.google.com/detail/opentechcheck/ijggpkkfefnlkinbpkkiihiciffpjnab" target="_blank" rel="noreferrer">Add to Chrome</a>
  </div>
</section>

<style>
  .hero { border-bottom: 1.5px solid var(--ink); overflow: hidden; }
  .herogrid { display: grid; grid-template-columns: 1.15fr 0.85fr; gap: 48px; padding-top: 72px; padding-bottom: 72px; align-items: center; }
  @media (max-width: 880px) { .herogrid { grid-template-columns: 1fr; } }
  h1 { font-family: var(--display); font-weight: 800; font-size: clamp(44px, 7vw, 76px); line-height: 0.97; letter-spacing: -0.035em; margin: 16px 0 0; }
  h1 em { font-style: normal; color: var(--blue); }
  .sub { margin-top: 22px; font-size: 17px; color: var(--dim); max-width: 46ch; }
  .ctas { display: flex; gap: 12px; margin-top: 28px; flex-wrap: wrap; }
  .trust { margin-top: 18px; font-size: 11px; letter-spacing: 0.1em; color: var(--dim); }

  .popupmock {
    background: var(--card); border: 1.5px solid var(--ink); border-radius: 12px;
    box-shadow: 8px 8px 0 var(--line);
    max-width: 380px; justify-self: end; width: 100%;
  }
  @media (max-width: 880px) { .popupmock { justify-self: start; } }
  .pm-head { display: flex; justify-content: space-between; align-items: center; padding: 12px 16px; border-bottom: 1.5px solid var(--ink); }
  .pm-site { font-size: 11px; color: var(--dim); }
  .pm-count { font-size: 10.5px; font-weight: 600; background: var(--blue); color: #fff; padding: 3px 8px; border-radius: 4px; }
  .pm-body { padding: 4px 16px 14px; }
  .pm-cat { font-size: 9px; font-weight: 600; letter-spacing: 0.14em; text-transform: uppercase; color: var(--dim); padding: 10px 0 5px; display: flex; align-items: center; gap: 8px; }
  .pm-cat::after { content: ''; flex: 1; height: 1px; background: var(--line); }
  .pm-row { display: flex; align-items: center; gap: 9px; padding: 5px 0; }
  .pm-tile { width: 26px; height: 26px; border: 1px solid var(--line); border-radius: 5px; display: flex; align-items: center; justify-content: center; background: #fff; flex: none; }
  .pm-tile img { width: 16px; height: 16px; object-fit: contain; }
  .pm-name { font-family: var(--display); font-weight: 700; font-size: 13.5px; }
  .pm-ver { font-size: 10.5px; color: var(--dim); margin-left: auto; }
  .pm-chip { font-size: 9.5px; font-weight: 600; padding: 2px 6px; border-radius: 4px; }
  .pm-row:has(.pm-ver) .pm-chip { margin-left: 0; }
  .pm-row:not(:has(.pm-ver)) .pm-chip { margin-left: auto; }
  .pm-chip.a { background: var(--green); color: var(--green-ink); }
  .pm-chip.b { background: var(--amber); color: var(--amber-ink); }
  .pm-chip.implied { background: var(--gray-chip); color: var(--dim); }
  .pm-ev { font-size: 10px; color: var(--ink); border-left: 3px solid var(--blue); background: var(--blue-soft); padding: 5px 9px; border-radius: 0 4px 4px 0; margin: 2px 0 4px; }
  .pm-ev b { color: var(--blue); font-weight: 600; letter-spacing: 0.08em; margin-right: 6px; }

  .ticker { border-top: 1.5px solid var(--ink); padding: 10px 0; white-space: nowrap; overflow: hidden; font-size: 12px; }
  .ticker span { display: inline-block; animation: scroll 40s linear infinite; }
  @keyframes scroll { from { transform: translateX(0); } to { transform: translateX(-50%); } }

  .features { border-bottom: 1.5px solid var(--ink); }
  .fgrid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 0; }
  @media (max-width: 880px) { .fgrid { grid-template-columns: 1fr; } }
  .feat { padding: 44px 28px 48px; border-left: 1px solid var(--line); }
  .feat:first-child { border-left: none; padding-left: 0; }
  @media (max-width: 880px) { .feat { border-left: none; padding: 28px 0; } }
  .fno { font-size: 11px; color: var(--blue); }
  .feat h3 { font-family: var(--display); font-weight: 800; font-size: 22px; letter-spacing: -0.02em; margin: 10px 0 10px; }
  .feat p { color: var(--dim); font-size: 15px; }

  .wall { border-bottom: 1.5px solid var(--ink); padding: 64px 0 72px; }
  .wall h2 { font-family: var(--display); font-weight: 800; font-size: clamp(26px, 4vw, 38px); letter-spacing: -0.03em; margin: 10px 0 28px; }
  .wallgrid { display: grid; grid-template-columns: repeat(auto-fill, minmax(56px, 1fr)); gap: 10px; }
  .wtile {
    aspect-ratio: 1; border: 1px solid var(--ink); border-radius: 8px; background: var(--card);
    display: flex; align-items: center; justify-content: center; text-decoration: none;
  }
  .wtile:hover { box-shadow: 3px 3px 0 var(--line); }
  .wtile img { width: 55%; height: 55%; object-fit: contain; }
  .wtile.more { font-size: 12px; font-weight: 600; color: var(--blue); background: var(--blue-soft); border-color: var(--blue); }

  .how { border-bottom: 1.5px solid var(--ink); padding: 64px 0 72px; }
  .steps { display: grid; grid-template-columns: repeat(3, 1fr); gap: 28px; margin-top: 26px; }
  @media (max-width: 880px) { .steps { grid-template-columns: 1fr; } }
  .sno { font-size: 12px; color: var(--blue); }
  .step h3 { font-family: var(--display); font-weight: 800; font-size: 20px; margin: 8px 0 8px; }
  .step p { color: var(--dim); font-size: 14.5px; }

  .final { padding: 84px 0; }
  .fin { display: flex; flex-direction: column; align-items: center; gap: 26px; text-align: center; }
  .fin h2 { font-family: var(--display); font-weight: 800; font-size: clamp(32px, 5vw, 52px); letter-spacing: -0.03em; }
  .fin h2 em { font-style: normal; color: var(--blue); }
</style>
