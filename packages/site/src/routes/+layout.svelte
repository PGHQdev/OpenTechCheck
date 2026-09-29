<script lang="ts">
  import { onMount } from 'svelte'
  import { parseTheme, themeStorageKey, toggleTheme, type Theme, type ThemePreference } from '$lib/theme'
  import '../site.css'
  let { children } = $props()

  let theme = $state<ThemePreference>('system')

  function systemTheme(): Theme {
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
  }

  function storedTheme(): Theme | undefined {
    try {
      return parseTheme(localStorage.getItem(themeStorageKey))
    } catch {
      return undefined
    }
  }

  function applyTheme(value: Theme | undefined) {
    if (value) {
      document.documentElement.dataset.theme = value
    } else {
      document.documentElement.removeAttribute('data-theme')
    }
  }

  function persistTheme(value: Theme) {
    try {
      localStorage.setItem(themeStorageKey, value)
    } catch {
      // The current tab still receives the selected theme when storage is unavailable.
    }
  }

  function toggleColorTheme() {
    const current = theme === 'system' ? systemTheme() : theme
    const next = toggleTheme(current)
    theme = next
    applyTheme(next)
    persistTheme(next)
  }

  onMount(() => {
    const media = window.matchMedia('(prefers-color-scheme: dark)')
    const saved = storedTheme()
    theme = saved ?? 'system'
    applyTheme(saved)

    const handleSystemThemeChange = () => {
      if (!parseTheme(document.documentElement.dataset.theme)) theme = 'system'
    }
    media.addEventListener('change', handleSystemThemeChange)
    return () => media.removeEventListener('change', handleSystemThemeChange)
  })
</script>

<nav>
  <div class="wrap bar">
    <a class="home" href="/">
      <span class="logo">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
          <rect x="3" y="4.5" width="14" height="4" rx="2" fill="currentColor" />
          <rect x="7" y="10" width="14" height="4" rx="2" fill="currentColor" opacity=".8" />
          <rect x="3" y="15.5" width="14" height="4" rx="2" fill="currentColor" opacity=".55" />
        </svg>
      </span>
      <span class="brand">OpenTechCheck</span>
    </a>
    <div class="links">
      <a href="https://github.com/PGHQdev/OpenTechCheck" target="_blank" rel="noreferrer">GitHub</a>
      <a href="https://github.com/PGHQdev/OpenTechCheck/blob/main/CONTRIBUTING.md" target="_blank" rel="noreferrer">Contribute</a>
      <button
        class="theme-toggle"
        type="button"
        aria-label={theme === 'system' ? 'Toggle color theme' : theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
        aria-pressed={theme === 'system' ? undefined : theme === 'dark'}
        title={theme === 'system' ? 'Toggle color theme' : theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
        onclick={toggleColorTheme}
      >
        <span class="theme-icon" aria-hidden="true"></span>
        <span>{theme === 'system' ? 'Theme' : theme === 'dark' ? 'Light' : 'Dark'}</span>
      </button>
      <a class="cta" href="https://chromewebstore.google.com/detail/opentechcheck/ijggpkkfefnlkinbpkkiihiciffpjnab" target="_blank" rel="noreferrer">Get the extension</a>
    </div>
  </div>
</nav>

{@render children()}

<footer>
  <div class="wrap foot">
    <div class="fleft">
      <span class="logo">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
          <rect x="3" y="4.5" width="14" height="4" rx="2" fill="currentColor" />
          <rect x="7" y="10" width="14" height="4" rx="2" fill="currentColor" opacity=".8" />
          <rect x="3" y="15.5" width="14" height="4" rx="2" fill="currentColor" opacity=".55" />
        </svg>
      </span>
      <span class="mono small">OPEN SOURCE · LOCAL · EVIDENCE-BASED</span>
    </div>
    <div class="fright mono small">
      <a href="/privacy">Privacy</a>
      <a href="/terms">Terms</a>
      <a href="https://github.com/PGHQdev/OpenTechCheck" target="_blank" rel="noreferrer">GitHub</a>
      <span>Apache-2.0</span>
    </div>
  </div>
</footer>

<style>
  nav { border-bottom: 1.5px solid var(--ink); background: var(--paper); position: sticky; top: 0; z-index: 10; }
  .bar { display: flex; align-items: center; justify-content: space-between; padding-top: 14px; padding-bottom: 14px; }
  .home { display: flex; align-items: center; gap: 10px; text-decoration: none; }
  .logo {
    width: 30px; height: 30px; border-radius: 7px; background: var(--blue-action); color: var(--on-accent);
    font-family: var(--mono); font-size: 10px; font-weight: 600;
    display: inline-flex; align-items: center; justify-content: center;
  }
  .brand { font-family: var(--display); font-weight: 800; font-size: 17px; letter-spacing: -0.02em; }
  .links { display: flex; align-items: center; gap: 22px; }
  .links a { font-weight: 600; font-size: 14.5px; text-decoration: none; }
  .links a:hover { color: var(--blue); }
  .theme-toggle {
    display: inline-flex; align-items: center; gap: 7px; border: 1px solid var(--line);
    border-radius: 7px; padding: 8px 10px; background: var(--card); color: var(--ink);
    font: 600 13px var(--text); cursor: pointer;
  }
  .theme-toggle:hover { border-color: var(--blue); color: var(--blue); background: var(--blue-soft); }
  .theme-icon { width: 13px; height: 13px; border: 1.5px solid currentColor; border-radius: 50%; display: inline-block; position: relative; overflow: hidden; }
  .theme-icon::after { content: ''; position: absolute; width: 9px; height: 9px; border-radius: 50%; background: currentColor; top: -3px; right: -3px; }
  .links .cta {
    background: var(--blue-action); color: var(--on-accent); padding: 9px 16px; border-radius: 7px;
  }
  .links .cta:hover { color: var(--on-accent); filter: brightness(1.12); }

  footer { border-top: 1.5px solid var(--ink); margin-top: 0; background: var(--paper); }
  .foot { display: flex; align-items: center; justify-content: space-between; padding-top: 22px; padding-bottom: 22px; flex-wrap: wrap; gap: 12px; }
  .fleft { display: flex; align-items: center; gap: 12px; }
  .small { font-size: 11px; letter-spacing: 0.08em; color: var(--dim); }
  .fright { display: flex; gap: 18px; }
  .fright a { text-decoration: none; }
  .fright a:hover { color: var(--blue); }
  @media (max-width: 640px) {
    .bar { flex-wrap: wrap; gap: 12px; }
    .links { width: 100%; gap: 12px 16px; flex-wrap: wrap; }
    .links a { font-size: 13px; }
    .fleft { flex-wrap: wrap; }
  }
</style>
