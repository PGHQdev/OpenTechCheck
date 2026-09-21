import { parseReport } from '../src/lib/report'
import { publicDomain } from '../../reporting/domain'

// Structural binding types keep this handler testable with SQLite locally.
export interface Env {
  DB: { prepare(sql: string): { bind(...values: string[]): { run(): Promise<{ success: boolean }> } } }
  ASSETS: { fetch(request: Request): Promise<Response> }
  REPORT_LIMITER: { limit(options: { key: string }): Promise<{ success: boolean }> }
}

const json = (body: unknown, status: number, headers: Record<string, string> = {}) =>
  Response.json(body, { status, headers: { 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff', ...headers } })

async function readBody(request: Request): Promise<string> {
  const reader = request.body?.getReader()
  if (!reader) return ''
  const decoder = new TextDecoder()
  let size = 0
  let text = ''
  try {
    while (true) {
      const { value, done } = await reader.read()
      if (done) break
      size += value.byteLength
      if (size > 12_000) { await reader.cancel(); throw new RangeError('Report is too large.') }
      text += decoder.decode(value, { stream: true })
    }
    return text + decoder.decode()
  } finally { reader.releaseLock() }
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url)
    const automatic = url.pathname === '/api/reports/automatic'
    if (url.pathname !== '/api/reports' && !automatic) return env.ASSETS.fetch(request)
    if (request.method !== 'POST') return json({ error: 'Method not allowed.' }, 405, { Allow: 'POST' })
    const origin = request.headers.get('Origin')
    if (automatic ? origin !== null && !/^(chrome-extension:\/\/[a-p]{32}|moz-extension:\/\/[a-f0-9-]{36})$/.test(origin) : origin !== url.origin) {
      return json({ error: 'Invalid report origin.' }, 403)
    }
    if (request.headers.get('Content-Type')?.split(';')[0]?.trim() !== 'application/json') return json({ error: 'Expected JSON.' }, 415)

    try {
      const { success } = await env.REPORT_LIMITER.limit({ key: request.headers.get('CF-Connecting-IP') ?? 'unknown' })
      if (!success) return json({ error: 'Too many reports. Please try again in a minute.' }, 429, { 'Retry-After': '60' })
      if (automatic) {
        let domain: string
        try {
          const data = JSON.parse(await readBody(request)) as Record<string, unknown>
          if (!data || Object.keys(data).length !== 1 || typeof data.domain !== 'string' || !publicDomain(data.domain)) throw new Error('Expected a public website domain only.')
          domain = data.domain
        } catch (error) { return json({ error: 'Expected a public website domain only.' }, error instanceof RangeError ? 413 : 400) }
        const stored = await env.DB.prepare(`
          INSERT INTO automatic_coverage_reports (domain) VALUES (?)
          ON CONFLICT(domain) DO UPDATE SET submission_count = submission_count + 1,
            last_seen = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
        `).bind(domain).run()
        if (!stored.success) throw new Error('Storage failed')
        return json({ ok: true }, 201)
      }
      let report
      try { report = parseReport(JSON.parse(await readBody(request))) }
      catch (error) {
        return json({ error: error instanceof SyntaxError ? 'Invalid report.' : error instanceof Error ? error.message : 'Invalid report.' }, error instanceof RangeError ? 413 : 400)
      }
      const stored = await env.DB.prepare(`
        INSERT INTO coverage_reports (id, website, report_type, extension_version, details, email)
        VALUES (?, ?, ?, ?, ?, ?) ON CONFLICT(id) DO NOTHING
      `).bind(report.id, report.website, report.type, report.extensionVersion, report.details, report.email).run()
      if (!stored.success) throw new Error('Storage failed')
      return json({ ok: true }, 201)
    } catch {
      // Do not log report contents or database errors that may contain them.
      return json({ error: 'We could not save your report. Please try again.' }, 503)
    }
  },
}
