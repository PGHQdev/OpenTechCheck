import { afterAll, beforeAll, expect, test } from 'bun:test'
import { join } from 'node:path'
import { $ } from 'bun'
import puppeteer, { type Browser } from 'puppeteer'
import { buildFrameworkFixture, serveFixture } from './serve'

const ROOT = join(import.meta.dir, '..')
const EXT = join(ROOT, 'dist', 'chrome')
const PORT = 8123
let browser: Browser
let server: ReturnType<typeof serveFixture>

beforeAll(async () => {
  // Self-contained: don't rely on an earlier test/build run having
  // populated dist/chrome. Build it here so `bun test e2e/` works from
  // a clean checkout.
  await $`bun run ${join(ROOT, 'build', 'build.ts')}`.cwd(ROOT)

  server = serveFixture(PORT, await buildFrameworkFixture())
  browser = await puppeteer.launch({
    headless: true,
    args: [
      `--disable-extensions-except=${EXT}`,
      `--load-extension=${EXT}`,
      // Ubuntu 23.10+ runners block unprivileged user namespaces via
      // AppArmor, so Chrome's sandbox cannot start on CI.
      ...(process.env.CI ? ['--no-sandbox', '--disable-setuid-sandbox'] : []),
    ],
  })
}, 120_000)
afterAll(async () => {
  try {
    await browser?.close()
  } finally {
    server?.stop()
  }
})

test('badge and popup reflect fixture detections', async () => {
  // Wait for the background service worker before navigating: its
  // chrome.webRequest.onHeadersReceived listener must be registered
  // before the navigation request completes, or the response headers
  // (and the nginx detection that depends on them) are missed for good.
  const workerTarget = await browser.waitForTarget((t) => t.type() === 'service_worker', { timeout: 15_000 })
  const worker = await workerTarget.worker()
  if (!worker) throw new Error('no service worker')

  const page = await browser.newPage()
  await page.goto(`http://localhost:${PORT}/`, { waitUntil: 'networkidle0' })

  const { tabId, slugs } = await worker.evaluate(async (fixtureUrl: string) => {
    for (let i = 0; i < 50; i++) {
      const all = await chrome.storage.session.get(null)
      const key = Object.keys(all).find((k) => {
        if (!k.startsWith('result:')) return false
        const result = all[k] as { url?: string }
        return result?.url === fixtureUrl
      })
      if (key) {
        const result = all[key] as { detections: Array<{ slug: string }> }
        return { tabId: Number(key.slice('result:'.length)), slugs: result.detections.map((d) => d.slug) }
      }
      await new Promise((r) => setTimeout(r, 200))
    }
    return { tabId: -1, slugs: [] as string[] }
  }, `http://localhost:${PORT}/`)

  expect(slugs).toContain('nextjs')
  expect(slugs).toContain('wordpress')
  expect(slugs).toContain('nginx')
  expect(slugs).toContain('react')

  // Badge text is set fire-and-forget right after the stored result, so
  // give it a few retries to settle rather than asserting immediately.
  let badgeText = ''
  for (let i = 0; i < 20; i++) {
    badgeText = await worker.evaluate((id: number) => chrome.action.getBadgeText({ tabId: id }), tabId)
    if (badgeText === String(slugs.length)) break
    await new Promise((r) => setTimeout(r, 100))
  }
  expect(badgeText).toBe(String(slugs.length))

  // The popup's load() resolves the "current" tab via the background's
  // sender.tab fallback, which only stays undefined (and so falls back to
  // querying the active tab) for a *real* action popup. Opening popup.html
  // as an ordinary Puppeteer tab defeats this: Chrome then treats that tab
  // as a genuine tab of its own (chrome.tabs.getCurrent() resolves), so
  // sender.tab points at the popup's own tab instead of the fixture's, and
  // get-result comes back null. chrome.action.openPopup() (Chrome 127+,
  // available in Puppeteer's bundled Chromium) opens the real, non-tab
  // popup surface instead, so it reads the fixture's cached result exactly
  // as a user clicking the toolbar icon would.
  await page.bringToFront()
  await worker.evaluate(() => (chrome.action as unknown as { openPopup(): Promise<void> }).openPopup())
  const popupTarget = await browser.waitForTarget((t) => t.url().endsWith('/popup.html'), { timeout: 10_000 })
  const popupPage = await popupTarget.asPage()
  await popupPage.waitForSelector('section button')

  const rows = await popupPage.$$('section button')
  expect(rows.length).toBeGreaterThanOrEqual(4)
  const popupText = await popupPage.evaluate(() => document.body.innerText)
  expect(popupText).toContain('Next.js')
  expect(popupText).toContain('WordPress')
  expect(popupText).toContain('Nginx')
  expect(popupText).toContain('React')

  await popupPage.close()
  await page.close()
}, 60_000)

// This exercises the real content/main-world handshake and background reporter.
// All fixture pages and report requests are intercepted; no reports leave tests.
test('late globals, mutations, popup refresh, and opt-in domain-only reports', async () => {
  const worker = await (await browser.waitForTarget((t) => t.type() === 'service_worker')).worker()
  if (!worker) throw new Error('no service worker')
  await worker.evaluate(() => {
    const g = globalThis as any
    g.reportRequests = []
    g.originalFetch = globalThis.fetch
    globalThis.fetch = async (input, init) => {
      if (String(input) === 'https://opentechcheck.com/api/reports/automatic') {
        g.reportRequests.push({ body: JSON.parse(String(init?.body)), credentials: init?.credentials, referrerPolicy: init?.referrerPolicy })
        return new Response('{"ok":true}', { status: 201 })
      }
      return g.originalFetch(input, init)
    }
  })
  const page = await browser.newPage()
  try {
    await page.setRequestInterception(true)
    page.on('request', (request) => {
      request.respond({ status: 200, contentType: 'text/html', body: '<!doctype html><title>Coverage fixture</title><button id="consent">Accept</button>' }).catch(() => {})
    })
    const url = 'https://coverage-fixture.net/path?token=private#secret'
    await page.goto(url, { waitUntil: 'networkidle0' })
    await page.bringToFront()
    const tabId = await worker.evaluate(async () => (await chrome.tabs.query({ active: true, currentWindow: true }))[0]!.id!)
    const result = () => worker.evaluate(async (id: number) => (await chrome.storage.session.get(`result:${id}`))[`result:${id}`], tabId)
    const waitFor = async (condition: () => Promise<boolean>, timeout = 15000) => {
      const end = Date.now() + timeout
      while (Date.now() < end) { if (await condition()) return; await new Promise((resolve) => setTimeout(resolve, 100)) }
      throw new Error('Condition did not become true')
    }
    await waitFor(async () => (await result())?.scan?.completed === true)
    // A global added without any DOM changes must be found by a follow-up scan.
    await page.evaluate(() => { (window as any).React = { version: '19.0.0' } })
    await waitFor(async () => (await result())?.detections.some((d: any) => d.slug === 'react'))
    expect((await result()).detections.find((d: any) => d.slug === 'react').version).toBe('19.0.0')

    // New SPA route resets the scan settling period and cached globals.
    await page.evaluate(() => { delete (window as any).React; history.pushState({}, '', '/empty?token=private#secret') })
    await waitFor(async () => (await result())?.url.includes('/empty') && (await result())?.detections.length === 0)
    await waitFor(async () => (await result())?.scan?.settled === true)
    expect(await worker.evaluate(() => (globalThis as any).reportRequests.length)).toBe(0)

    // An HTTP fixture lacks a real peer address. Supply a controlled public
    // connection record to exercise the positive reporting gate in isolation.
    await worker.evaluate(async (id: number) => {
      await chrome.storage.session.set({ [`connection:${id}`]: { url: 'https://coverage-fixture.net/empty', ip: '8.8.8.8', status: 200 } })
      await chrome.action.openPopup()
    }, tabId)
    const popup = await (await browser.waitForTarget((t) => t.url().endsWith('/popup.html'))).asPage()
    await popup.waitForSelector('.settings summary')
    await popup.click('.settings summary')
    await popup.waitForSelector('.setting input:not(:disabled)')
    expect(await popup.$eval('.setting input', (el) => (el as HTMLInputElement).checked)).toBe(false)
    await popup.click('.setting input')
    await waitFor(async () => await worker.evaluate(() => (globalThis as any).reportRequests.length === 1))
    expect(await worker.evaluate(() => (globalThis as any).reportRequests[0])).toEqual({ body: { domain: 'coverage-fixture.net' }, credentials: 'omit', referrerPolicy: 'no-referrer' })
    await popup.screenshot({ path: '/tmp/otc-auto-setting.png' })
    await popup.click('.setting input')
    expect(await worker.evaluate(async () => (await chrome.storage.local.get('autoReportEnabled')).autoReportEnabled)).toBe(false)
    await popup.close()

    // Consent interaction after initial follow-ups still triggers a scan.
    await page.evaluate(() => { document.querySelector('button')!.addEventListener('click', () => { (window as any).React = { version: '19.1.0' } }) })
    await page.click('#consent')
    await waitFor(async () => (await result())?.detections.some((d: any) => d.slug === 'react'))
    expect((await result()).detections.find((d: any) => d.slug === 'react').version).toBe('19.1.0')

    // DOM mutation after the initial observation window also gets collected.
    await page.evaluate(() => { const meta = document.createElement('meta'); meta.name = 'generator'; meta.content = 'WordPress 6.7'; document.head.append(meta) })
    await waitFor(async () => (await result())?.detections.some((d: any) => d.slug === 'wordpress'))
    // Attribute-only framework hydration on an existing node must be observed.
    await page.evaluate(() => { document.querySelector('button')!.setAttribute('x-data', '{}') })
    await waitFor(async () => (await result())?.detections.some((d: any) => d.slug === 'alpinejs'))
    expect(await worker.evaluate(() => (globalThis as any).reportRequests.length)).toBe(1)
  } finally {
    await page.close()
    await worker.evaluate(async () => {
      globalThis.fetch = (globalThis as any).originalFetch
      await chrome.storage.local.set({ autoReportEnabled: false })
    })
  }
}, 60000)

test('production framework probes detect deep mounts and nested shadow DOM', async () => {
  const worker = await (await browser.waitForTarget((t) => t.type() === 'service_worker')).worker()
  if (!worker) throw new Error('no service worker')
  const page = await browser.newPage()
  try {
    await page.goto(`http://localhost:${PORT}/frameworks`, { waitUntil: 'networkidle0' })
    await page.bringToFront()
    const detections = await worker.evaluate(async () => {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true })
      for (let i = 0; i < 150; i++) {
        const result = (await chrome.storage.session.get(`result:${tab!.id}`))[`result:${tab!.id}`]
        const slugs = result?.detections.map((d: any) => d.slug) ?? []
        if (result?.scan?.completed && ['preact', 'alpinejs', 'lit', 'svelte'].every((slug) => slugs.includes(slug))) return result.detections
        await new Promise((resolve) => setTimeout(resolve, 100))
      }
      throw new Error('Framework probes did not complete with expected production detections')
    })
    const bySlug = new Map(detections.map((d: any) => [d.slug, d])) as Map<string, any>
    for (const slug of ['preact', 'alpinejs', 'lit']) {
      expect(bySlug.get(slug).evidence.some((e: any) => e.key === `$probe.${slug}`)).toBe(true)
    }
    expect(bySlug.get('svelte').version).toBe('5')
    expect(bySlug.has('react')).toBe(false)
    expect(await page.evaluate(() => (window as any).litHtmlVersions)).toBeUndefined()
    // After all startup follow-ups, a shadow-only mount must trigger detection.
    await new Promise((resolve) => setTimeout(resolve, 11000))
    await page.evaluate(() => {
      const root = document.getElementById('lit-fixture')!.shadowRoot!.firstElementChild!.shadowRoot!
      const mount = document.createElement('div')
      ;(mount as any).__ngContext__ = 0
      root.append(mount)
    })
    const angular = await worker.evaluate(async () => {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true })
      for (let i = 0; i < 100; i++) {
        const result = (await chrome.storage.session.get(`result:${tab!.id}`))[`result:${tab!.id}`]
        const detection = result?.detections.find((d: any) => d.slug === 'angular')
        if (detection) return detection
        await new Promise((resolve) => setTimeout(resolve, 100))
      }
      throw new Error('Shadow-only late mount was not detected')
    })
    expect(angular.evidence.some((e: any) => e.key === '$probe.angular')).toBe(true)
  } finally { await page.close() }
}, 30000)
