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
    args: [`--disable-extensions-except=${EXT}`, `--load-extension=${EXT}`],
  })
}, 120_000)
afterAll(async () => {
  try {
    await browser?.close()
  } finally {
    server?.stop()
  }
})

test('badge and stored result reflect fixture detections', async () => {
  // Wait for the background service worker before navigating: its
  // chrome.webRequest.onHeadersReceived listener must be registered
  // before the navigation request completes, or the response headers
  // (and the nginx detection that depends on them) are missed for good.
  const workerTarget = await browser.waitForTarget((t) => t.type() === 'service_worker', { timeout: 15_000 })
  const worker = await workerTarget.worker()
  if (!worker) throw new Error('no service worker')

  const page = await browser.newPage()
  await page.goto(`http://localhost:${PORT}/`, { waitUntil: 'networkidle0' })

  const slugs: string[] = await worker.evaluate(async (fixtureUrl: string) => {
    for (let i = 0; i < 50; i++) {
      const all = await chrome.storage.session.get(null)
      const key = Object.keys(all).find((k) => {
        if (!k.startsWith('result:')) return false
        const result = all[k] as { url?: string }
        return result?.url === fixtureUrl
      })
      if (key) return (all[key] as { detections: Array<{ slug: string }> }).detections.map((d) => d.slug)
      await new Promise((r) => setTimeout(r, 200))
    }
    return []
  }, `http://localhost:${PORT}/`)

  expect(slugs).toContain('nextjs')
  expect(slugs).toContain('wordpress')
  expect(slugs).toContain('nginx')
  await page.close()
}, 60_000)
