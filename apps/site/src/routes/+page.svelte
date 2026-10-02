<script lang="ts">
  import { count } from '../registry-count.json'
  const store = 'https://chromewebstore.google.com/detail/opentechcheck/ijggpkkfefnlkinbpkkiihiciffpjnab'
  const repo = 'https://github.com/PGHQdev/OpenTechCheck'
  const countLabel = count.toLocaleString('en-US')
  const demo: Array<{ cat: string; items: Array<{ icon: string; name: string; version?: string; grade?: string; ev?: string; implied?: boolean }> }> = [
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
  const found = demo.reduce((n, group) => n + group.items.length, 0)
  const featured = [
    { slug: 'wordpress', name: 'WordPress' },
    { slug: 'shopify', name: 'Shopify' },
    { slug: 'wix', name: 'Wix' },
    { slug: 'google-analytics', name: 'Google Analytics' },
    { slug: 'stripe', name: 'Stripe' },
    { slug: 'cloudflare', name: 'Cloudflare' },
    { slug: 'react', name: 'React' },
    { slug: 'django', name: 'Django' },
  ]
</script>

<svelte:head>
  <title>OpenTechCheck — see what websites are built with</title>
  <meta name="description" content="Open-source browser extension that identifies the frameworks, website builders, analytics tools, and other technologies a website uses. Detection runs in your browser." />
  <meta property="og:title" content="OpenTechCheck — see what websites are built with" />
  <meta property="og:description" content="Identify the frameworks, website builders, analytics tools, and other technologies a website uses, right from your browser." />
</svelte:head>

<section class="hero">
  <div class="wrap herogrid">
    <div class="herotext">
      <div class="eyebrow">Open-source browser extension</div>
      <h1>See what websites are <em>built with.</em></h1>
      <p class="sub">
        Identify the frameworks, website builders, analytics tools, and other
        technologies a website uses—right from your browser.
      </p>
      <div class="ctas">
        <a class="btn primary" href={store} target="_blank" rel="noreferrer">Add to Chrome</a>
        <a class="btn secondary" href={repo} target="_blank" rel="noreferrer">View on GitHub ↗</a>
        <span class="license">Apache-2.0 license</span>
      </div>
      <p class="note">No account required. Detection runs in your browser.</p>
    </div>

    <figure class="preview">
      <div class="browser" aria-hidden="true">
        <div class="bw-bar">
          <span class="bw-dots"><i></i><i></i><i></i></span>
          <span class="bw-address">yoursite.example</span>
          <span class="bw-ext"><img src="/favicon.png" alt="" /></span>
        </div>
        <div class="bw-page">
          <div class="fake">
            <div class="f-nav"><i></i><i></i><i></i><i></i></div>
            <div class="f-hero"></div>
            <div class="f-line w80"></div>
            <div class="f-line w60"></div>
            <div class="f-cards"><i></i><i></i><i></i></div>
          </div>

          <div class="popupmock">
            <div class="pm-head">
              <span class="pm-site mono">yoursite.example</span>
              <span class="pm-count mono">{found} FOUND</span>
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
      </div>
      <figcaption>
        <dl class="legend">
          <div><dt><span class="pm-chip a mono">A</span></dt><dd>Strong match: confidence 90 or higher.</dd></div>
          <div><dt><span class="pm-chip b mono">B</span></dt><dd>Good match: confidence 75 to 89.</dd></div>
          <div><dt><span class="pm-chip implied mono">IMPLIED</span></dt><dd>Inferred from another detected technology, such as Ruby from Ruby on Rails.</dd></div>
        </dl>
      </figcaption>
    </figure>
  </div>
</section>

<section class="band">
  <div class="wrap">
    <h2>Check a website in three steps</h2>
    <ol class="steps">
      <li>
        <span class="sno">1</span>
        <h3>Install the extension</h3>
        <p>Add OpenTechCheck to Chrome.</p>
      </li>
      <li>
        <span class="sno">2</span>
        <h3>Visit a website</h3>
        <p>Open the page you want to check.</p>
      </li>
      <li>
        <span class="sno">3</span>
        <h3>See its technologies</h3>
        <p>Click the extension to view detected technologies, grouped by category.</p>
      </li>
    </ol>
  </div>
</section>

<section class="band split">
  <div class="wrap twocol">
    <div>
      <h2>See why a technology was detected</h2>
      <p class="lead">
        Inspect the signals behind each result, including page tags, headers,
        and JavaScript properties. Copy the results as text or export the
        detection details as JSON.
      </p>
    </div>
    <div class="evcard" aria-hidden="true">
      <div class="evhead mono"><span>EVIDENCE · RUBY ON RAILS</span><span>LOCAL</span></div>
      <div class="evline mono"><b>meta · csrf-param</b> authenticity_token</div>
      <div class="evline mono"><b>cookies · _session_id</b> present</div>
      <div class="evline mono"><b>html</b> name="authenticity_token"</div>
    </div>
  </div>
</section>

<section class="band">
  <div class="wrap twocol">
    <div>
      <h2>Detection runs locally</h2>
      <p class="lead">
        OpenTechCheck checks the page in your browser. Automatic domain
        reporting is off unless you enable it.
      </p>
      <a class="more" href="/privacy">Read the privacy policy</a>
    </div>
    <div class="facts">
      <div class="fact">
        <h3>Stays in your browser</h3>
        <ul>
          <li>The page signals the extension reads: HTML, scripts, headers, cookies, and meta tags.</li>
          <li>Detection results. They stay in temporary storage for each tab and clear when you close the tab.</li>
          <li>Copied text and exported JSON. They go only to your clipboard or downloads folder.</li>
        </ul>
      </div>
      <div class="fact">
        <h3>Sent only if you choose</h3>
        <ul>
          <li>A detection report. You open the report form and press Submit. It sends the website address without query parameters, the report type, the extension version, and any details or email you add.</li>
          <li>Automatic domain reports. When you enable this setting, the extension sends only the domain of websites where it detects no technologies.</li>
        </ul>
      </div>
    </div>
  </div>
</section>

<section class="band">
  <div class="wrap">
    <div class="eyebrow">{countLabel} supported technologies</div>
    <h2>Browse supported technologies</h2>
    <p class="lead">
      Explore the technologies OpenTechCheck can detect, from WordPress and
      Shopify to React and Django.
    </p>
    <ul class="logos">
      {#each featured as tech}
        <li><span class="ltile"><img src={`/icons/${tech.slug}.png`} alt="" /></span>{tech.name}</li>
      {/each}
    </ul>
    <a class="btn secondary" href="/technologies">Browse technologies</a>
  </div>
</section>

<section class="band">
  <div class="wrap">
    <h2>Open source. Contributions welcome.</h2>
    <p class="lead">
      Read the code, report an incorrect result, or help add a missing
      technology. Detection rules are stored in readable YAML files and tested
      against captured websites.
    </p>
    <div class="ctas">
      <a class="btn secondary" href={repo} target="_blank" rel="noreferrer">View on GitHub ↗</a>
      <a class="btn secondary" href={`${repo}/issues/new`} target="_blank" rel="noreferrer">Report a detection issue ↗</a>
      <a class="btn secondary" href={`${repo}/blob/main/CONTRIBUTING.md`} target="_blank" rel="noreferrer">Read the contribution guide ↗</a>
    </div>
  </div>
</section>

<section class="final">
  <div class="wrap fin">
    <h2>Check a website's technologies.</h2>
    <a class="btn primary" href={store} target="_blank" rel="noreferrer">Add to Chrome</a>
  </div>
</section>

<style>
  .hero { border-bottom: 1.5px solid var(--ink); overflow: hidden; }
  .herogrid { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); gap: 48px; padding-top: 64px; padding-bottom: 64px; align-items: center; }
  @media (max-width: 920px) { .herogrid { grid-template-columns: minmax(0, 1fr); gap: 40px; padding-top: 44px; padding-bottom: 48px; } }
  .eyebrow { font-weight: 600; font-size: 14px; color: var(--blue); }
  h1 { font-family: var(--display); font-weight: 800; font-size: clamp(38px, 5vw, 54px); line-height: 1; letter-spacing: -0.035em; margin: 14px 0 0; }
  h1 em { font-style: normal; color: var(--blue); }
  .sub { margin-top: 20px; font-size: 18px; color: var(--dim); max-width: 44ch; }
  .ctas { display: flex; gap: 12px; margin-top: 28px; flex-wrap: wrap; align-items: center; }
  .license { font-size: 14px; color: var(--dim); }
  .note { margin-top: 16px; font-size: 15px; color: var(--dim); }

  .preview { margin: 0; min-width: 0; }
  .browser {
    background: var(--card); border: 1.5px solid var(--ink); border-radius: 12px;
    box-shadow: 8px 8px 0 var(--line); overflow: hidden;
  }
  .bw-bar { display: flex; align-items: center; gap: 12px; padding: 9px 12px; border-bottom: 1.5px solid var(--ink); background: var(--paper); }
  .bw-dots { display: flex; gap: 6px; flex: none; }
  .bw-dots i { width: 10px; height: 10px; border-radius: 50%; border: 1px solid var(--ink); background: var(--card); }
  .bw-address {
    flex: 1; min-width: 0; font-size: 13px; color: var(--dim); background: var(--card);
    border: 1px solid var(--line); border-radius: 6px; padding: 4px 10px;
    white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
  }
  .bw-ext {
    flex: none; width: 28px; height: 28px; border-radius: 6px; display: flex; align-items: center; justify-content: center;
    background: var(--blue-soft); outline: 1.5px solid var(--blue);
  }
  .bw-ext img { width: 18px; height: 18px; }
  .bw-page { position: relative; min-height: 530px; padding: 18px; }
  .fake { opacity: 0.55; }
  .f-nav i, .f-hero, .f-line, .f-cards i { background: var(--gray-chip); border-radius: 4px; }
  .f-nav { display: flex; gap: 10px; }
  .f-nav i { width: 48px; height: 10px; }
  .f-nav i:first-child { width: 80px; background: var(--line); }
  .f-hero { height: 120px; margin: 18px 0 16px; }
  .f-line { height: 12px; margin-bottom: 10px; }
  .w80 { width: 80%; }
  .w60 { width: 60%; }
  .f-cards { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; margin-top: 18px; }
  .f-cards i { height: 90px; }

  .popupmock {
    position: absolute; top: 10px; right: 12px; width: min(330px, calc(100% - 24px));
    background: var(--card); border: 1.5px solid var(--ink); border-radius: 10px;
    box-shadow: 6px 6px 0 rgba(20, 19, 16, 0.12);
  }
  .popupmock::before {
    content: ''; position: absolute; top: -8px; right: 8px; width: 14px; height: 14px;
    background: var(--card); border-left: 1.5px solid var(--ink); border-top: 1.5px solid var(--ink);
    transform: rotate(45deg);
  }
  .pm-head { display: flex; justify-content: space-between; align-items: center; padding: 10px 14px; border-bottom: 1.5px solid var(--ink); }
  .pm-site { font-size: 12px; color: var(--dim); }
  .pm-count { font-size: 11px; font-weight: 600; background: var(--blue); color: #fff; padding: 3px 8px; border-radius: 4px; }
  .pm-body { padding: 2px 14px 12px; }
  .pm-cat { font-size: 10.5px; font-weight: 600; letter-spacing: 0.12em; text-transform: uppercase; color: var(--dim); padding: 8px 0 4px; display: flex; align-items: center; gap: 8px; }
  .pm-cat::after { content: ''; flex: 1; height: 1px; background: var(--line); }
  .pm-row { display: flex; align-items: center; gap: 9px; padding: 4px 0; }
  .pm-tile { width: 26px; height: 26px; border: 1px solid var(--line); border-radius: 5px; display: flex; align-items: center; justify-content: center; background: #fff; flex: none; }
  .pm-tile img { width: 16px; height: 16px; object-fit: contain; }
  .pm-name { font-family: var(--display); font-weight: 700; font-size: 14px; }
  .pm-ver { font-size: 12px; color: var(--dim); margin-left: auto; }
  .pm-chip { font-size: 11px; font-weight: 600; padding: 2px 6px; border-radius: 4px; }
  .pm-row:not(:has(.pm-ver)) .pm-chip { margin-left: auto; }
  .pm-chip.a { background: var(--green); color: var(--green-ink); }
  .pm-chip.b { background: var(--amber); color: var(--amber-ink); }
  .pm-chip.implied { background: var(--gray-chip); color: var(--dim); }
  .pm-ev { font-size: 11.5px; color: var(--ink); border-left: 3px solid var(--blue); background: var(--blue-soft); padding: 5px 9px; border-radius: 0 4px 4px 0; margin: 2px 0 4px; }
  .pm-ev b { color: var(--blue); font-weight: 600; letter-spacing: 0.08em; margin-right: 6px; }

  .legend { display: grid; gap: 8px; margin-top: 22px; }
  .legend div { display: flex; align-items: baseline; gap: 10px; }
  .legend dt { flex: none; min-width: 64px; }
  .legend dd { font-size: 15px; color: var(--dim); }

  .band { border-bottom: 1.5px solid var(--ink); padding: 64px 0 68px; }
  h2 { font-family: var(--display); font-weight: 800; font-size: clamp(28px, 4vw, 38px); line-height: 1.1; letter-spacing: -0.03em; margin: 0; }
  .band .eyebrow + h2 { margin-top: 8px; }
  h3 { font-family: var(--display); font-weight: 800; font-size: 20px; letter-spacing: -0.01em; margin: 0 0 6px; }
  .lead { margin-top: 14px; font-size: 17px; color: var(--dim); max-width: 56ch; }

  .steps { list-style: none; display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 28px; margin-top: 30px; }
  @media (max-width: 880px) { .steps { grid-template-columns: minmax(0, 1fr); gap: 22px; } }
  .sno {
    display: inline-flex; align-items: center; justify-content: center; width: 32px; height: 32px; margin-bottom: 12px;
    border-radius: 50%; background: var(--blue); color: #fff; font-weight: 700; font-size: 15px;
  }
  .steps p { color: var(--dim); font-size: 16px; }

  .twocol { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); gap: 48px; align-items: start; }
  @media (max-width: 880px) { .twocol { grid-template-columns: minmax(0, 1fr); gap: 28px; } }
  .evcard { background: var(--card); border: 1.5px solid var(--ink); border-radius: 10px; padding: 14px 16px; box-shadow: 6px 6px 0 var(--line); }
  .evhead { display: flex; justify-content: space-between; font-size: 11.5px; font-weight: 600; letter-spacing: 0.08em; color: var(--blue); margin-bottom: 8px; gap: 12px; }
  .evline { font-size: 13px; border-left: 3px solid var(--blue); background: var(--blue-soft); padding: 6px 10px; border-radius: 0 4px 4px 0; margin-top: 6px; overflow-wrap: anywhere; }
  .evline b { font-weight: 600; margin-right: 6px; }

  .more { display: inline-block; margin-top: 16px; font-weight: 600; color: var(--blue); }
  .facts { display: grid; gap: 16px; }
  .fact { background: var(--card); border: 1px solid var(--line); border-radius: 10px; padding: 18px 20px; }
  .fact ul { padding-left: 18px; display: grid; gap: 6px; }
  .fact li { font-size: 15.5px; color: #3c3a33; }

  .logos { list-style: none; display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 12px; margin: 28px 0; }
  @media (max-width: 720px) { .logos { grid-template-columns: repeat(2, minmax(0, 1fr)); } }
  .logos li {
    display: flex; align-items: center; gap: 12px; padding: 12px 14px; min-width: 0;
    border: 1px solid var(--ink); border-radius: 8px; background: var(--card);
    font-weight: 600; font-size: 15px;
  }
  .ltile { width: 28px; height: 28px; flex: none; display: flex; align-items: center; justify-content: center; }
  .ltile img { width: 24px; height: 24px; object-fit: contain; }

  .final { padding: 80px 0; }
  .fin { display: flex; flex-direction: column; align-items: center; gap: 26px; text-align: center; }
  .fin h2 { font-size: clamp(32px, 5vw, 48px); }

  @media (max-width: 520px) {
    .bw-page { min-height: 540px; padding: 14px; }
    .ctas .btn { flex: 1 1 auto; justify-content: center; }
  }
</style>
