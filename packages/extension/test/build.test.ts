import { expect, test } from 'bun:test'
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { $ } from 'bun'

const root = join(import.meta.dir, '..')

test('build emits both targets with correct manifests', async () => {
  await $`bun run ${join(root, 'build', 'build.ts')}`.cwd(root)
  for (const target of ['chrome', 'firefox']) {
    for (const f of ['manifest.json', 'background.js', 'content.js', 'main-world.js', 'popup.html', 'popup.js']) {
      expect(existsSync(join(root, 'dist', target, f))).toBe(true)
    }
    const manifest = JSON.parse(readFileSync(join(root, 'dist', target, 'manifest.json'), 'utf8'))
    expect(manifest.permissions).toEqual(['webRequest', 'cookies', 'storage', 'webNavigation', 'tabs'])
    const html = readFileSync(join(root, 'dist', target, 'popup.html'), 'utf8')
    expect(html).toContain('popup.js')
    expect(html).not.toContain('../')
  }
  const chrome = JSON.parse(readFileSync(join(root, 'dist', 'chrome', 'manifest.json'), 'utf8'))
  const firefox = JSON.parse(readFileSync(join(root, 'dist', 'firefox', 'manifest.json'), 'utf8'))
  expect(chrome.background.service_worker).toBe('background.js')
  expect(firefox.background.scripts).toEqual(['background.js'])
  const content = readFileSync(join(root, 'dist', 'chrome', 'content.js'), 'utf8')
  expect(content).not.toContain('virtual:lists')
}, 120_000)
