import { expect, test } from 'bun:test'
import { Window } from 'happy-dom'
import { createShadowWatcher } from '../src/main-world/shadow-watcher'

test('shadow changes invalidate a pass even before observer delivery and stay observed', async () => {
  const w = new Window()
  const host = w.document.createElement('div')
  w.document.body.append(host)
  const root = host.attachShadow({ mode: 'open' })
  let changes = 0
  const watcher = createShadowWatcher(w.MutationObserver as unknown as typeof MutationObserver, () => changes++)
  watcher.observe(root as unknown as ShadowRoot)
  const before = watcher.revision()
  root.append(w.document.createElement('div'))
  expect(watcher.revision()).toBeGreaterThan(before)
  expect(changes).toBe(1)
  root.firstElementChild!.setAttribute('data-mounted', '')
  await new Promise((resolve) => setTimeout(resolve, 10))
  expect(changes).toBe(2)
  watcher.disconnect()
  watcher.observe(root as unknown as ShadowRoot)
  root.append(w.document.createElement('span'))
  watcher.revision()
  expect(changes).toBe(3)
  watcher.disconnect()
  await w.happyDOM.close()
})
