import { afterAll, beforeAll, expect, test } from 'bun:test'
import { join } from 'node:path'
import { $ } from 'bun'
import puppeteer, { type Browser } from 'puppeteer'
import { serveFixture } from './serve'

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

  server = serveFixture(PORT)
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
  expect(rows.length).toBeGreaterThanOrEqual(3)
  const popupText = await popupPage.evaluate(() => document.body.innerText)
  expect(popupText).toContain('Next.js')
  expect(popupText).toContain('WordPress')
  expect(popupText).toContain('Nginx')

  await popupPage.close()
  await page.close()
}, 60_000)
