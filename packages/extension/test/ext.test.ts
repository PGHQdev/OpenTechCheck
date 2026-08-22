import { expect, test } from 'bun:test'

test('ext resolves browser over chrome', async () => {
  ;(globalThis as any).browser = { runtime: { id: 'ff' } }
  ;(globalThis as any).chrome = { runtime: { id: 'cr' } }
  const { resolveExt } = await import('../src/shared/ext')
  expect((resolveExt() as any).runtime.id).toBe('ff')
  delete (globalThis as any).browser
  expect((resolveExt() as any).runtime.id).toBe('cr')
})
