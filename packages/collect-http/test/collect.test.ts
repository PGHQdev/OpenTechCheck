import { expect, test } from 'bun:test'
import { collect } from '../src/index'

const okFetch = (body: string, init: ResponseInit = {}) =>
  (async () => new Response(body, { headers: { 'content-type': 'text/html' }, ...init })) as unknown as typeof fetch

test('happy path returns bundle with final url', async () => {
  const r = await collect('https://a.com', { fetch: okFetch('<html>x</html>') })
  expect(r.ok).toBe(true)
  if (r.ok) expect(r.bundle.html).toContain('x')
})

test('non-html content type -> non_html error', async () => {
  const f = (async () => new Response('{}', { headers: { 'content-type': 'application/json' } })) as unknown as typeof fetch
  const r = await collect('https://a.com', { fetch: f })
  expect(r).toMatchObject({ ok: false, error: { code: 'non_html' } })
})

test('http error status -> http_error', async () => {
  const r = await collect('https://a.com', { fetch: okFetch('nope', { status: 500 }) })
  expect(r).toMatchObject({ ok: false, error: { code: 'http_error' } })
})

test('network failure -> fetch_failed', async () => {
  const f = (async () => { throw new TypeError('boom') }) as unknown as typeof fetch
  const r = await collect('https://a.com', { fetch: f })
  expect(r).toMatchObject({ ok: false, error: { code: 'fetch_failed' } })
})

test('timeout -> timeout error', async () => {
  const f = ((_url: unknown, init?: RequestInit) =>
    new Promise((_resolve, reject) => {
      init?.signal?.addEventListener('abort', () => reject(new DOMException('aborted', 'AbortError')))
    })) as unknown as typeof fetch
  const r = await collect('https://a.com', { fetch: f, timeoutMs: 20 })
  expect(r).toMatchObject({ ok: false, error: { code: 'timeout' } })
})
