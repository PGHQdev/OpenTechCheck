import { expect, test } from 'bun:test'
import { createScanScheduler } from '../src/content/scan-scheduler'

function setup() {
  let now = 0
  let next = 0
  const timers = new Map<number, { at: number; fn: () => void }>()
  const scans: Array<{ at: number; settled: boolean }> = []
  const scheduler = createScanScheduler({ now: () => now, scan: (settled) => scans.push({ at: now, settled }),
    setTimer: (fn, ms) => { const id = ++next; timers.set(id, { at: now + ms, fn }); return id },
    clearTimer: (id) => { timers.delete(id as number) },
  })
  function advance(ms: number) {
    const end = now + ms
    while (true) {
      const pending = [...timers].filter(([, t]) => t.at <= end).sort((a, b) => a[1].at - b[1].at)[0]
      if (!pending) break
      now = pending[1].at; timers.delete(pending[0]); pending[1].fn()
    }
    now = end
  }
  return { scheduler, scans, advance }
}

test('initial and follow-up scans run before an empty page is considered settled', () => {
  const { scheduler, scans, advance } = setup()
  scheduler.start()
  advance(9999)
  expect(scans.length).toBeGreaterThan(1)
  expect(scans.every((s) => !s.settled)).toBe(true)
  advance(1)
  expect(scans.at(-1)).toEqual({ at: 10000, settled: true })
})

test('mutation bursts are throttled, and a late change delays settled reporting', () => {
  const { scheduler, scans, advance } = setup()
  scheduler.start(); advance(9500)
  for (let i = 0; i < 1000; i++) scheduler.changed()
  advance(500)
  expect(scans.at(-1)?.settled).toBe(false)
  const count = scans.length
  advance(1500)
  expect(scans.length).toBe(count + 1)
  expect(scans.at(-1)?.settled).toBe(true)
})

test('navigation starts a fresh waiting period and dispose cancels scheduled work', () => {
  const { scheduler, scans, advance } = setup()
  scheduler.start(); advance(9000); scheduler.start(); advance(1000)
  expect(scans.at(-1)?.settled).toBe(false)
  scheduler.dispose()
  const count = scans.length
  advance(20000)
  expect(scans.length).toBe(count)
})
