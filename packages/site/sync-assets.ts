// Copies shared assets (fonts, tech icons, app icon) into static/.
// static/fonts and static/icons are gitignored; this runs before dev/build.
import { cpSync, mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { Glob } from 'bun'

const here = import.meta.dir
const ext = join(here, '..', 'extension')
mkdirSync(join(here, 'static', 'fonts'), { recursive: true })
cpSync(join(ext, 'src', 'popup', 'fonts'), join(here, 'static', 'fonts'), { recursive: true })
cpSync(join(here, '..', 'fingerprints', 'icons'), join(here, 'static', 'icons'), { recursive: true })
cpSync(join(ext, 'assets', 'icon-128.png'), join(here, 'static', 'favicon.png'))

const registry = join(here, '..', 'fingerprints', 'src', 'registry')
const count = [...new Glob('**/*.yaml').scanSync(registry)].length
writeFileSync(join(here, 'src', 'registry-count.json'), JSON.stringify({ count }) + '\n')
console.log(`assets synced, ${count} fingerprints`)
