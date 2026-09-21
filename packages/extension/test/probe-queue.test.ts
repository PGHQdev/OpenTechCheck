import { expect, test } from 'bun:test'
import { createProbeQueue } from '../src/main-world/probe-queue'
import type { ProbeResult } from '../src/main-world/probes'

test('overlapping requests run sequentially without relabeling stale evidence', async () => {
  let resolve!: (value: ProbeResult) => void
  let scans = 0
  const sent: unknown[] = []
  const queue = createProbeQueue({
    url: () => 'https://example.com/',
    scan: () => { scans++; return new Promise((r) => { resolve = r }) },
    send: (id, result) => sent.push({ id, result }),
  })
  queue.request('old'); queue.request('latest')
  expect(scans).toBe(1)
  resolve({ js: { '$probe.react': 'detected' }, complete: true })
  await Promise.resolve()
  expect(sent).toEqual([{ id: 'old', result: { js: { '$probe.react': 'detected' }, complete: true } }])
  expect(scans).toBe(2)
  resolve({ js: { '$probe.vue': 'detected' }, complete: true })
  await Promise.resolve()
  expect(sent[1]).toEqual({ id: 'latest', result: { js: { '$probe.vue': 'detected' }, complete: true } })
})

test('navigation aborts old probes and never sends their evidence to the new page', async () => {
  let url = 'https://example.com/old'
  const jobs: Array<{ signal: AbortSignal; resolve: (value: ProbeResult) => void }> = []
  const sent: string[] = []
  const queue = createProbeQueue({
    url: () => url,
    scan: (signal) => new Promise((resolve) => jobs.push({ signal, resolve })),
    send: (id) => sent.push(id),
  })
  queue.request('old')
  url = 'https://example.com/new'; queue.request('new')
  expect(jobs[0]!.signal.aborted).toBe(true)
  jobs[0]!.resolve({ js: { '$probe.react': 'detected' }, complete: true })
  await Promise.resolve()
  expect(sent).toEqual([])
  expect(jobs).toHaveLength(2)
  queue.cancel()
  jobs[1]!.resolve({ js: {}, complete: true })
  await Promise.resolve()
  expect(sent).toEqual([])
})

test('probe failures are explicitly incomplete', async () => {
  const sent: ProbeResult[] = []
  const queue = createProbeQueue({ url: () => 'https://example.com/', scan: async () => { throw new Error('hostile DOM') }, send: (_id, result) => sent.push(result) })
  queue.request('scan')
  await Promise.resolve()
  expect(sent).toEqual([{ js: {}, complete: false }])
})
