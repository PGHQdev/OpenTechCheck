// Copies shared assets (fonts, tech icons, app icon) into static/.
// static/fonts and static/icons are gitignored; this runs before dev/build.
import { cpSync, mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { scanRegistry } from './src/lib/registry'

const here = import.meta.dir
const ext = join(here, '..', 'extension')
mkdirSync(join(here, 'static', 'fonts'), { recursive: true })
cpSync(join(ext, 'src', 'popup', 'fonts'), join(here, 'static', 'fonts'), { recursive: true })
cpSync(join(here, '..', '..', 'packages', 'fingerprints', 'icons'), join(here, 'static', 'icons'), { recursive: true })
cpSync(join(ext, 'assets', 'icon-128.png'), join(here, 'static', 'favicon.png'))

const techs = scanRegistry(join(here, '..', '..', 'packages', 'fingerprints', 'src', 'registry'))
const count = techs.length
writeFileSync(join(here, 'src', 'registry-count.json'), JSON.stringify({ count }) + '\n')
writeFileSync(join(here, 'src', 'registry-catalog.json'), JSON.stringify(techs) + '\n')
console.log(`assets synced, ${count} fingerprints`)
