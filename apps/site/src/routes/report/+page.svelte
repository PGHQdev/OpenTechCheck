<script lang="ts">
  import { onMount, tick } from 'svelte'
  import { cleanWebsite, parseReport, type ReportType } from '$lib/report'

  let website = $state('')
  let type = $state<ReportType>('detection-issue')
  let extensionVersion = $state('')
  let details = $state('')
  let email = $state('')
  let ready = $state(false)
  let submitting = $state(false)
  let submitted = $state(false)
  let error = $state('')
  let id = ''
  let lastPayload = ''
  let successHeading = $state<HTMLHeadingElement>()

  onMount(() => {
    const prefill = new URLSearchParams(location.hash.slice(1))
    try { website = cleanWebsite(prefill.get('website') ?? '') } catch { /* direct visits start blank */ }
    type = prefill.get('type') === 'coverage-gap' ? 'coverage-gap' : 'detection-issue'
    const version = prefill.get('version') ?? ''
    extensionVersion = /^\d+(?:\.\d+){0,3}$/.test(version) && version.length <= 32 ? version : ''
    id = crypto.randomUUID()
    // Clear the prefill from the address bar and this history entry.
    history.replaceState(history.state, '', '/report')
    ready = true
  })

  function sanitizeWebsite() {
    try { website = cleanWebsite(website) } catch { /* submit displays validation errors */ }
  }

  async function submit(event: SubmitEvent) {
    event.preventDefault()
    if (submitting || submitted) return
    error = ''
    submitting = true
    try {
      const report = parseReport({ id, website, type, extensionVersion, details, email })
      website = report.website
      const payload = JSON.stringify({ ...report, id: '' })
      // Retry identical submissions with the same ID. Edits after an ambiguous
      // network failure are a new report, not an ignored duplicate of the old one.
      if (lastPayload && payload !== lastPayload) id = crypto.randomUUID()
      report.id = id
      lastPayload = payload
      const response = await fetch('/api/reports', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        credentials: 'omit', referrerPolicy: 'no-referrer', body: JSON.stringify(report),
      })
      const body = await response.json() as { ok?: boolean; error?: string }
      if (!response.ok || !body.ok) throw new Error(body.error ?? 'We could not save your report. Please try again.')
      submitted = true
      await tick()
      successHeading?.focus()
    } catch (cause) {
      error = cause instanceof TypeError || cause instanceof SyntaxError
        ? 'We could not connect. Your report is still here—please try again.'
        : cause instanceof Error ? cause.message : 'We could not save your report. Please try again.'
    } finally { submitting = false }
  }
</script>

<svelte:head>
  <title>Report a website — OpenTechCheck</title>
  <meta name="description" content="Help improve technology detection. Submit a private report to the OpenTechCheck team. No account required." />
  <meta name="robots" content="noindex, nofollow" />
  <meta name="referrer" content="no-referrer" />
</svelte:head>

<main class="wrap report-page">
  <div class="kicker">HELP IMPROVE COVERAGE</div>
  {#if submitted}
    <h1 bind:this={successHeading} tabindex="-1">Thanks for helping.</h1>
    <p class="intro" role="status">Your report is in our review queue.</p>
    <a class="btn secondary" href="/">Back to OpenTechCheck</a>
  {:else}
    <h1>Report this website.</h1>
    <p class="intro">No account. No required explanation. Just submit.</p>
    {#if ready}
      <form onsubmit={submit}>
        <input type="hidden" name="reportType" value={type} />
        <label for="website">Website</label>
        <input id="website" name="website" type="url" required maxlength="2048" placeholder="https://example.com" bind:value={website} onblur={sanitizeWebsite} disabled={submitting} aria-describedby="website-help" />
        <p class="hint" id="website-help">Query parameters and page fragments are removed. You can edit the address.</p>
        {#if extensionVersion}
          <label for="version">Extension version</label>
          <input id="version" name="extensionVersion" value={extensionVersion} readonly class="version" />
        {/if}
        <details>
          <summary>Add details <span>(optional)</span></summary>
          <label for="details">What's missing or incorrect?</label>
          <textarea id="details" name="details" rows="4" maxlength="3000" bind:value={details} disabled={submitting} placeholder="A technology name or anything else that might help."></textarea>
          <label for="email">Email <span>(optional)</span></label>
          <input id="email" name="email" type="email" maxlength="254" bind:value={email} disabled={submitting} autocomplete="email" placeholder="Only if you'd like us to follow up" />
        </details>
        <div class="assurance">
          <strong>Private report. No account required.</strong>
          <p>Only these fields and an automatic report category are submitted. No page contents, cookies, or browsing history. Reports are visible only to our team.</p>
          <a href="/privacy">How we handle reports ↗</a>
        </div>
        {#if error}<p class="error" role="alert">{error}</p>{/if}
        <button class="btn primary" type="submit" disabled={submitting}>{submitting ? 'Submitting…' : 'Submit report'}</button>
      </form>
    {:else}
      <p class="hint">Preparing your report…</p>
      <noscript>Enable JavaScript to submit a report. Nothing is sent until you choose Submit report.</noscript>
    {/if}
  {/if}
</main>

<style>
  .report-page { max-width: 680px; padding-top: 56px; padding-bottom: 72px; min-height: 70vh; }
  h1 { font-family: var(--display); font-size: clamp(30px, 6vw, 44px); font-weight: 800; letter-spacing: -.035em; line-height: 1.15; margin: 12px 0; }
  .intro { color: var(--dim); margin-bottom: 30px; }
  form { background: var(--card); border: 1px solid var(--ink); border-radius: 10px; padding: 28px; }
  label { display: block; font-weight: 600; font-size: 14px; margin-bottom: 8px; }
  input:not([type="hidden"]), textarea { display: block; width: 100%; border: 1px solid #aaa69a; border-radius: 6px; padding: 11px 12px; font: inherit; color: var(--ink); background: var(--card); }
  textarea { resize: vertical; margin-bottom: 18px; }
  input:focus-visible, textarea:focus-visible, summary:focus-visible, button:focus-visible { outline: 2px solid var(--blue); outline-offset: 3px; }
  .hint { font-size: 12px; color: var(--dim); margin: 8px 0 20px; }
  input.version { font-family: var(--mono); font-size: 13px; background: var(--paper); }
  details { border-top: 1px solid var(--line); border-bottom: 1px solid var(--line); padding: 16px 0; margin: 24px 0; }
  summary { cursor: pointer; font-weight: 600; font-size: 14px; }
  details[open] summary { margin-bottom: 20px; }
  span { color: var(--dim); font-weight: 400; }
  .assurance { margin: 0 0 24px; font-size: 13px; }
  .assurance strong { display: block; margin-bottom: 6px; }
  .assurance p { color: var(--dim); line-height: 1.65; }
  .assurance a { display: inline-block; margin-top: 8px; color: var(--blue); }
  .error { color: #9b241c; margin-bottom: 16px; }
  button:disabled { opacity: .6; cursor: wait; }
  @media (max-width: 520px) { .report-page { padding-top: 36px; } form { padding: 20px; } .btn { width: 100%; justify-content: center; } }
</style>
