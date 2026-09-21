interface ScanClock {
  now(): number
  scan(settled: boolean): void
  setTimer(fn: () => void, ms: number): unknown
  clearTimer(timer: unknown): void
}

export function createScanScheduler(clock: ScanClock) {
  let started = 0
  let lastChange = 0
  let active = false
  let mutationTimer: unknown
  const followups: unknown[] = []
  const run = () => {
    if (active) clock.scan(clock.now() - started >= 10_000 && clock.now() - lastChange >= 1500)
  }
  const scheduleMutation = () => {
    if (!active || mutationTimer !== undefined) return
    mutationTimer = clock.setTimer(() => {
      mutationTimer = undefined
      run()
      // One final quiet scan after a continuing burst. Continuous mutation
      // still gets at most one observer-triggered scan every two seconds.
      if (clock.now() - lastChange < 1500) scheduleMutation()
    }, 2000)
  }
  const dispose = () => {
    active = false
    followups.splice(0).forEach((t) => clock.clearTimer(t))
    if (mutationTimer !== undefined) clock.clearTimer(mutationTimer)
    mutationTimer = undefined
  }
  return {
    start() {
      dispose(); active = true; started = lastChange = clock.now()
      run()
      for (const delay of [1000, 3000, 10_000]) followups.push(clock.setTimer(run, delay))
    },
    refresh: run,
    changed() { lastChange = clock.now(); scheduleMutation() },
    dispose,
  }
}
