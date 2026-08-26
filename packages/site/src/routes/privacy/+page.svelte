<svelte:head>
  <title>Privacy — OpenTechCheck</title>
  <meta name="description" content="OpenTechCheck privacy policy: the extension collects nothing and sends nothing." />
</svelte:head>

<div class="wrap legal">
  <div class="kicker">POLICY</div>
  <h1>Privacy</h1>
  <p class="updated">Last updated: August 24, 2026</p>

  <p>
    OpenTechCheck is built so that this policy can stay short. The extension
    analyzes web pages locally in your browser and has no server to send
    anything to.
  </p>

  <h2>The browser extension</h2>
  <ul>
    <li>All technology detection runs inside your browser, on your device.</li>
    <li>The extension makes no network requests. Fingerprints, icons, and fonts ship inside the extension package.</li>
    <li>No browsing history, page content, URL, or detection result ever leaves your browser.</li>
    <li>There is no account, no sign-in, no telemetry, no analytics, and no advertising.</li>
    <li>Detection results are kept in temporary browser session storage per tab and are discarded when the tab closes.</li>
    <li>The "Export JSON" and "Copy stack" actions write only to your clipboard or your downloads folder, at your request.</li>
  </ul>

  <h2>Why the extension requests broad permissions</h2>
  <ul>
    <li><span class="mono">host access on all sites</span> — technology detection has to read the page you are viewing. It reads; it never transmits.</li>
    <li><span class="mono">webRequest</span> — response headers (for example <span class="mono">server: nginx</span>) are detection signals. Headers are inspected locally and stored only in per-tab session storage.</li>
    <li><span class="mono">cookies</span> — cookie names (for example <span class="mono">laravel_session</span>) identify technologies. Cookie values are matched locally and never transmitted.</li>
    <li><span class="mono">storage</span> — holds per-tab detection results until the tab closes.</li>
  </ul>

  <h2>This website</h2>
  <ul>
    <li>opentechcheck.com is a static site. It sets no cookies and runs no analytics or tracking scripts.</li>
    <li>The site is served by Cloudflare, whose infrastructure processes standard request logs (IP address, user agent) to deliver the site. See <a href="https://www.cloudflare.com/privacypolicy/" target="_blank" rel="noreferrer">Cloudflare's privacy policy</a>.</li>
  </ul>

  <h2>Changes and contact</h2>
  <p>
    If this policy changes, the change lands as a public commit in the
    <a href="https://github.com/PGHQdev/OpenTechCheck" target="_blank" rel="noreferrer">open-source repository</a>
    before it appears here. Questions or concerns:
    <a href="https://github.com/PGHQdev/OpenTechCheck/issues" target="_blank" rel="noreferrer">open an issue</a>.
  </p>
</div>
