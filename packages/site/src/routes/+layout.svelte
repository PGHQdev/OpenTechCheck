<script lang="ts">
  import '../site.css'
  let { children } = $props()
</script>

<nav>
  <div class="wrap bar">
    <a class="home" href="/">
      <span class="logo">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
          <rect x="3" y="4.5" width="14" height="4" rx="2" fill="#fff" />
          <rect x="7" y="10" width="14" height="4" rx="2" fill="#fff" opacity=".8" />
          <rect x="3" y="15.5" width="14" height="4" rx="2" fill="#fff" opacity=".55" />
        </svg>
      </span>
      <span class="brand">OpenTechCheck</span>
    </a>
    <div class="links">
      <a href="https://github.com/opentechcheck/opentechcheck" target="_blank" rel="noreferrer">GitHub</a>
      <a href="https://github.com/opentechcheck/opentechcheck/blob/main/CONTRIBUTING.md" target="_blank" rel="noreferrer">Contribute</a>
      <a class="cta" href="https://github.com/opentechcheck/opentechcheck#browser-extension">Get the extension</a>
    </div>
  </div>
</nav>

{@render children()}

<footer>
  <div class="wrap foot">
    <div class="fleft">
      <span class="logo">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
          <rect x="3" y="4.5" width="14" height="4" rx="2" fill="#fff" />
          <rect x="7" y="10" width="14" height="4" rx="2" fill="#fff" opacity=".8" />
          <rect x="3" y="15.5" width="14" height="4" rx="2" fill="#fff" opacity=".55" />
        </svg>
      </span>
      <span class="mono small">OPEN SOURCE · LOCAL · EVIDENCE-BASED</span>
    </div>
    <div class="fright mono small">
      <a href="/privacy">Privacy</a>
      <a href="/terms">Terms</a>
      <a href="https://github.com/opentechcheck/opentechcheck" target="_blank" rel="noreferrer">GitHub</a>
      <span>Apache-2.0</span>
    </div>
  </div>
</footer>

<style>
  nav { border-bottom: 1.5px solid var(--ink); background: var(--paper); position: sticky; top: 0; z-index: 10; }
  .bar { display: flex; align-items: center; justify-content: space-between; padding-top: 14px; padding-bottom: 14px; }
  .home { display: flex; align-items: center; gap: 10px; text-decoration: none; }
  .logo {
    width: 30px; height: 30px; border-radius: 7px; background: var(--blue); color: #fff;
    font-family: var(--mono); font-size: 10px; font-weight: 600;
    display: inline-flex; align-items: center; justify-content: center;
  }
  .brand { font-family: var(--display); font-weight: 800; font-size: 17px; letter-spacing: -0.02em; }
  .links { display: flex; align-items: center; gap: 22px; }
  .links a { font-weight: 600; font-size: 14.5px; text-decoration: none; }
  .links a:hover { color: var(--blue); }
  .links .cta {
    background: var(--blue); color: #fff; padding: 9px 16px; border-radius: 7px;
  }
  .links .cta:hover { color: #fff; filter: brightness(1.12); }

  footer { border-top: 1.5px solid var(--ink); margin-top: 0; background: var(--paper); }
  .foot { display: flex; align-items: center; justify-content: space-between; padding-top: 22px; padding-bottom: 22px; flex-wrap: wrap; gap: 12px; }
  .fleft { display: flex; align-items: center; gap: 12px; }
  .small { font-size: 11px; letter-spacing: 0.08em; color: var(--dim); }
  .fright { display: flex; gap: 18px; }
  .fright a { text-decoration: none; }
  .fright a:hover { color: var(--blue); }
</style>
