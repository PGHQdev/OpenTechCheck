import { expect, test } from 'bun:test'
import { createAutoReporter, eligibleForAutoReport, type AutoReportApi } from '../src/background/auto-report'
import { publicDomain, publicAddress } from '../../reporting/domain'

function setup() {
  const state: Record<string, unknown> = {}
  const requests: Array<{ url: string; init: RequestInit }> = []
  let now = Date.UTC(2026, 8, 21)
  let eligible = true
  const api: AutoReportApi = {
    storage: { get: async (key) => ({ [key]: state[key] }), set: async (values) => { Object.assign(state, values) } },
    now: () => now, eligible: async () => eligible,
    fetch: async (url, init) => { requests.push({ url, init }); return new Response('{}', { status: 201 }) },
  }
  return { state, requests, reporter: createAutoReporter(api), day: () => { now += 86400000 }, ineligible: () => { eligible = false } }
}

test('automatic reporting is off by default and sends exactly the domain after opt-in', async () => {
  const { reporter, state, requests } = setup()
  await reporter.report('public-site.com', 1, 'scan')
  expect(requests).toHaveLength(0)
  state.autoReportEnabled = true
  await reporter.report('public-site.com', 1, 'scan')
  expect(requests).toHaveLength(1)
  expect(JSON.parse(requests[0]!.init.body as string)).toEqual({ domain: 'public-site.com' })
  expect(requests[0]!.init.credentials).toBe('omit')
  expect(requests[0]!.init.referrerPolicy).toBe('no-referrer')
})

test('concurrent and repeated visits deduplicate persistently and respect daily limits', async () => {
  const { reporter, state, requests, day } = setup()
  state.autoReportEnabled = true
  await Promise.all([reporter.report('public-site.com', 1, 'scan'), reporter.report('public-site.com', 2, 'scan')])
  expect(requests).toHaveLength(1)
  for (let i = 0; i < 15; i++) await reporter.report(`site${i}.com`, 1, 'scan')
  expect(requests).toHaveLength(10)
  day()
  await reporter.report('public-site.com', 1, 'scan')
  expect(requests).toHaveLength(10)
  expect(JSON.stringify(state)).not.toContain('public-site.com')
})

test('canceled, navigated, private or failed scans do not submit', async () => {
  const { reporter, state, requests, ineligible } = setup()
  state.autoReportEnabled = true
  ineligible()
  await reporter.report('public-site.com', 1, 'scan')
  expect(requests).toHaveLength(0)
  for (const host of ['localhost', 'printer.local', 'intranet', '192.168.1.1', '127.0.0.1', '[::1]', 'site.test', 'opentechcheck.com']) expect(publicDomain(host)).toBeNull()
  for (const ip of [undefined, '127.0.0.1', '10.1.1.1', '192.168.1.1', '172.16.2.1', '169.254.1.1', '100.64.1.1', '::1', 'fc00::1', '::ffff:192.168.1.1']) expect(publicAddress(ip)).toBe(false)
  expect(publicAddress('8.8.8.8')).toBe(true)
  expect(publicAddress('2606:4700:4700::1111')).toBe(true)
})

test('opting out during the final eligibility check cancels before any request starts', async () => {
  const state: Record<string, unknown> = { autoReportEnabled: true }
  let checks = 0
  let requests = 0
  const reporter = createAutoReporter({
    storage: { get: async (key) => ({ [key]: state[key] }), set: async (values) => { Object.assign(state, values) } },
    now: () => Date.now(),
    eligible: async () => {
      if (++checks === 3) { state.autoReportEnabled = false; reporter.cancel() }
      return true
    },
    fetch: async () => { requests++; return new Response('{}') },
  })
  await reporter.report('public-site.com', 1, 'scan')
  expect(requests).toBe(0)
})

test('reporting eligibility rejects incognito, stale, failed and private-network pages', () => {
  const tab = { url: 'https://public-site.com/page', incognito: false }
  const scan = { id: 'scan', document: 'doc', sequence: 4, completed: true, settled: true }
  const result = { url: tab.url, detections: [], scan }
  const connection = { url: tab.url, ip: '8.8.8.8', status: 200 }
  expect(eligibleForAutoReport(tab, result, connection, 'scan')).toBe(true)
  expect(eligibleForAutoReport({ ...tab, incognito: true }, result, connection, 'scan')).toBe(false)
  expect(eligibleForAutoReport({ ...tab, incognito: undefined }, result, connection, 'scan')).toBe(false)
  expect(eligibleForAutoReport({ ...tab, url: 'https://another.com/' }, result, connection, 'scan')).toBe(false)
  expect(eligibleForAutoReport(tab, result, connection, 'old-scan')).toBe(false)
  expect(eligibleForAutoReport(tab, null, connection, 'scan')).toBe(false)
  for (const change of [{ completed: false }, { settled: false }]) {
    expect(eligibleForAutoReport(tab, { ...result, scan: { ...scan, ...change } }, connection, 'scan')).toBe(false)
  }
  for (const change of [{ ip: undefined }, { ip: '10.0.0.1' }, { status: 500 }, { url: 'https://another.com/' }]) {
    expect(eligibleForAutoReport(tab, result, { ...connection, ...change }, 'scan')).toBe(false)
  }
})
