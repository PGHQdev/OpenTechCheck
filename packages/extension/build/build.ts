import { mkdirSync, writeFileSync, readFileSync, existsSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import { build } from 'vite'
import { mergeManifest } from './manifest'
import base from '../manifest/base.json'
import chromeOverlay from '../manifest/chrome.json'
import firefoxOverlay from '../manifest/firefox.json'

const root = join(import.meta.dir, '..')
const overlays = { chrome: chromeOverlay, firefox: firefoxOverlay } as const

for (const target of ['chrome', 'firefox'] as const) {
  const outDir = join(root, 'dist', target)
  rmSync(outDir, { recursive: true, force: true })
  mkdirSync(outDir, { recursive: true })
  process.env.OTC_OUTDIR = outDir
  for (const mode of ['background', 'content', 'main-world', 'popup']) {
    await build({ root, mode, configFile: join(root, 'vite.config.ts') })
  }
  // vite emits the popup page at its source path; hoist it to the dist root
  const nested = join(outDir, 'src', 'popup', 'popup.html')
  if (existsSync(nested)) {
    let html = readFileSync(nested, 'utf8')
    html = html.replace(/(src|href)="(\.\.\/)+/g, '$1="')
    writeFileSync(join(outDir, 'popup.html'), html)
    rmSync(join(outDir, 'src'), { recursive: true, force: true })
  }
  writeFileSync(
    join(outDir, 'manifest.json'),
    JSON.stringify(mergeManifest(base, overlays[target]), null, 2),
  )
  console.log(`built dist/${target}`)
}
