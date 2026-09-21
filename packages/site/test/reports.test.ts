import { afterEach, expect, test } from 'bun:test'
import { Database } from 'bun:sqlite'
import { readFileSync } from 'node:fs'
import worker, { type Env } from '../worker/index'

const databases: Database[] = []
function setup() {
  const db = new Database(':memory:')
  databases.push(db)
  db.exec(readFileSync(new URL('../migrations/0001_reports.sql', import.meta.url), 'utf8'))
  db.exec(readFileSync(new URL('../migrations/0002_automatic_reports.sql', import.meta.url), 'utf8'))
  const env: Env = {
    DB: { prepare: (sql: string) => ({ bind: (...values: any[]) => ({
      run: async () => { db.query(sql).run(...values); return { success: true } },
    }) }) },
    REPORT_LIMITER: { limit: async () => ({ success: true }) },
    ASSETS: { fetch: async () => new Response('static page') },
  }
  return { db, env }
}
afterEach(() => { for (const db of databases.splice(0)) db.close() })
const draft = () => ({ id: crypto.randomUUID(), website: 'https://example.com/page?token=secret#private', type: 'coverage-gap', extensionVersion: '0.1.0', details: '', email: '' })
const request = (body: unknown, origin = 'https://opentechcheck.com') => new Request('https://opentechcheck.com/api/reports', {
  method: 'POST', headers: { 'Content-Type': 'application/json', Origin: origin, 'CF-Connecting-IP': '192.0.2.1' }, body: JSON.stringify(body),
})

test('stores a private report with a sanitized URL and retries without duplicates', async () => {
  const { db, env } = setup()
  const body = draft()
  expect((await worker.fetch(request(body), env)).status).toBe(201)
  expect((await worker.fetch(request(body), env)).status).toBe(201)
  expect(db.query('SELECT website, report_type, extension_version, status FROM coverage_reports').all()).toEqual([
    { website: 'https://example.com/page', report_type: 'coverage-gap', extension_version: '0.1.0', status: 'new' },
  ])
})

test('opening the form never creates a report and reports cannot be listed publicly', async () => {
  const { db, env } = setup()
  expect(await (await worker.fetch(new Request('https://opentechcheck.com/report'), env)).text()).toBe('static page')
  expect((await worker.fetch(new Request('https://opentechcheck.com/api/reports'), env)).status).toBe(405)
  expect(db.query('SELECT * FROM coverage_reports').all()).toEqual([])
})

test('rejects invalid types, unsafe URLs, invalid email, excess content and extra private fields', async () => {
  const { db, env } = setup()
  for (const change of [{ type: 'anything' }, { website: 'javascript:alert(1)' }, { website: 'https://user:password@example.com/' }, { email: 'invalid' }, { details: 'x'.repeat(3001) }, { html: '<p>private</p>' }]) {
    expect((await worker.fetch(request({ ...draft(), ...change }), env)).status).toBe(400)
  }
  expect(db.query('SELECT * FROM coverage_reports').all()).toEqual([])
})

test('rejects cross-origin submissions and rate-limited requests without storing them', async () => {
  const { db, env } = setup()
  expect((await worker.fetch(request(draft(), 'https://elsewhere.example'), env)).status).toBe(403)
  env.REPORT_LIMITER.limit = async () => ({ success: false })
  expect((await worker.fetch(request(draft()), env)).status).toBe(429)
  expect(db.query('SELECT * FROM coverage_reports').all()).toEqual([])
})

test('handles malformed or oversized JSON and storage failure without claiming success', async () => {
  const { env } = setup()
  const malformed = request(draft())
  expect((await worker.fetch(new Request(malformed, { body: '{' }), env)).status).toBe(400)
  expect((await worker.fetch(request({ ...draft(), details: 'x'.repeat(13000) }), env)).status).toBe(413)
  env.DB.prepare = () => { throw new Error('database unavailable') }
  expect((await worker.fetch(request(draft()), env)).status).toBe(503)
})

test('automatic reports accept only a public domain and aggregate separately from manual reports', async () => {
  const { db, env } = setup()
  const automatic = (body: unknown) => new Request('https://opentechcheck.com/api/reports/automatic', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
  })
  for (let i = 0; i < 2; i++) expect((await worker.fetch(automatic({ domain: 'public-site.com' }), env)).status).toBe(201)
  expect(db.query('SELECT domain, report_type, submission_count FROM automatic_coverage_reports').all()).toEqual([
    { domain: 'public-site.com', report_type: 'automatic-coverage-gap', submission_count: 2 },
  ])
  for (const body of [{ domain: 'public-site.com', version: '0.1.0' }, { domain: 'public-site.com/path' }, { domain: 'localhost' }, { domain: '192.168.1.1' }, { domain: 'printer.local' }, { domain: 'https://public-site.com/' }]) {
    expect((await worker.fetch(automatic(body), env)).status).toBe(400)
  }
  const fromWebsite = new Request(automatic({ domain: 'public-site.com' }), { headers: { 'Content-Type': 'application/json', Origin: 'https://random-site.com' } })
  expect((await worker.fetch(fromWebsite, env)).status).toBe(403)
  expect(db.query('SELECT * FROM coverage_reports').all()).toEqual([])
})
