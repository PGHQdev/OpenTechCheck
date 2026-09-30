<svelte:head>
  <title>Privacy — OpenTechCheck</title>
  <meta name="description" content="OpenTechCheck privacy policy: local detection and voluntary private reports." />
</svelte:head>

<div class="wrap legal">
  <div class="kicker">POLICY</div>
  <h1>Privacy</h1>
  <p class="updated">Last updated: September 21, 2026</p>

  <p>
    OpenTechCheck is built so that this policy can stay short. The extension
    analyzes web pages locally in your browser. You can choose to submit a private
    report to help us improve detection.
  </p>

  <h2>The browser extension</h2>
  <ul>
    <li>All technology detection runs inside your browser, on your device.</li>
    <li>Fingerprints, icons, and fonts ship inside the extension package. Detection itself makes no network requests.</li>
    <li>Manual reports send a website address only when you press Submit report. Separately, an optional setting can automatically report domains where detection finds nothing, as described below.</li>
    <li>No account or sign-in is required. There is no advertising or general browsing analytics.</li>
    <li>Detection results are kept in temporary browser session storage per tab and are discarded when the tab closes.</li>
    <li>The "Export JSON" and "Copy stack" actions write only to your clipboard or your downloads folder, at your request.</li>
  </ul>

  <h2>Why the extension requests broad permissions</h2>
  <ul>
    <li><span class="mono">host access on all sites</span> — technology detection has to read the page you are viewing. Used to read detection signals locally. Reporting is a separate, voluntary action.</li>
    <li><span class="mono">webRequest</span> — response headers (for example <span class="mono">server: nginx</span>) are detection signals. Headers are inspected locally and stored only in per-tab session storage.</li>
    <li><span class="mono">cookies</span> — cookie names (for example <span class="mono">laravel_session</span>) identify technologies. Cookie values are matched locally and never transmitted.</li>
    <li><span class="mono">storage</span> — holds per-tab detection results until the tab closes.</li>
  </ul>

  <h2>This website</h2>
  <ul>
    <li>The website sets no cookies and runs no analytics or tracking scripts. The report form stores reports only when submitted.</li>
    <li>The site is served by Cloudflare, whose infrastructure processes standard request logs (IP address, user agent) to deliver the site. See <a href="https://www.cloudflare.com/privacypolicy/" target="_blank" rel="noreferrer">Cloudflare's privacy policy</a>.</li>
  </ul>

  <h2>Voluntary reports</h2>
  <ul>
    <li>No account or GitHub login is required. Opening the report form does not submit a report.</li>
    <li>Reports contain the website address, an automatic category, the extension version when available, and any details or contact email you choose to provide. A random report ID prevents duplicate submissions on retry.</li>
    <li>We remove URL query parameters and fragments. The remaining address is visible and editable before submission. Avoid including private information in the address or notes.</li>
    <li>We do not attach page contents, cookies, browsing history, or detection evidence. Reports are sent over HTTPS and stored in Cloudflare D1, accessible to our authorized team for investigation and follow-up.</li>
    <li>The service uses your IP address for rate limiting; it is not stored in the report table. Cloudflare may process standard infrastructure request logs.</li>
  </ul>

  <h2>Optional automatic coverage reports</h2>
  <ul>
    <li>“Automatically report undetected websites” is off by default. You can enable or disable it in the extension's Coverage settings.</li>
    <li>When enabled, the extension may report a website domain after completed follow-up scans find no technologies. The report contains only the domain: no URL path, query, extension version, page contents, cookies, or user identifier.</li>
    <li>We skip private browsing, local-network websites, failed page loads, and scans whose completion or public connection cannot be verified.</li>
    <li>To avoid repeat submissions within 30 days, the extension keeps hashed domain records locally, with a limit of ten automatic report attempts per day. These records and your setting are not synced to other devices. Older records are removed as new automatic reports are processed.</li>
    <li>The service aggregates reports by domain in Cloudflare D1, adding a category, counts, and receipt times. We do not store the sender's IP address in report tables. Cloudflare processes network metadata to deliver and rate-limit requests.</li>
    <li>Switching the setting off stops future automatic submissions. It does not withdraw reports already received.</li>
  </ul>

  <h2>Changes and contact</h2>
  <p>
    If this policy changes, the change lands as a public commit in the
    <a href="https://github.com/PGHQdev/OpenTechCheck" target="_blank" rel="noreferrer">open-source repository</a>
    before it appears here. Questions or concerns:
    <a href="https://github.com/PGHQdev/OpenTechCheck/issues" target="_blank" rel="noreferrer">open an issue</a>.
  </p>
</div>
