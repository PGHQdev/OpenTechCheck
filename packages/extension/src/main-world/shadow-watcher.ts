/** Observe discovered roots without retaining detached hosts in a separate list. */
export function createShadowWatcher(Observer: typeof MutationObserver, changed: () => void) {
  let roots = new WeakSet<ShadowRoot>()
  let revision = 0
  const notify = (records: MutationRecord[]) => {
    if (!records.length) return
    revision++
    changed()
  }
  const observer = new Observer(notify)
  return {
    observe(root: ShadowRoot) {
      if (roots.has(root)) return
      observer.observe(root, { subtree: true, childList: true, attributes: true, characterData: true })
      roots.add(root)
    },
    revision() {
      // Include records queued in the same task before declaring a scan complete.
      notify(observer.takeRecords())
      return revision
    },
    disconnect() { observer.disconnect(); roots = new WeakSet(); revision++ },
  }
}
