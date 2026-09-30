import type { ProbeResult } from './probes'

interface ProbeQueueApi {
  url(): string
  scan(signal: AbortSignal): Promise<ProbeResult>
  send(requestId: string, result: ProbeResult): void
}

/** Keep only the newest waiting request; each response belongs to its own pass. */
export function createProbeQueue(api: ProbeQueueApi) {
  let pending: { id: string; url: string } | undefined
  let current: { controller: AbortController; url: string } | undefined
  let running = false
  async function drain() {
    if (running) return
    running = true
    try {
      while (pending) {
        const request = pending
        pending = undefined
        const controller = new AbortController()
        current = { controller, url: request.url }
        let result: ProbeResult
        try { result = await api.scan(controller.signal) }
        catch { result = { js: {}, complete: false } }
        if (!controller.signal.aborted && api.url() === request.url) {
          api.send(request.id, result)
        }
      }
    } finally { current = undefined; running = false }
  }
  return {
    request(id: string) {
      pending = { id, url: api.url() }
      if (current && current.url !== pending.url) current.controller.abort()
      void drain().catch(() => { /* hostile messaging must not escape the probe */ })
    },
    cancel() { pending = undefined; current?.controller.abort() },
  }
}
