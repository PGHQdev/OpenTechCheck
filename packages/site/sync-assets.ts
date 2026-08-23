// Copies shared assets (fonts, tech icons, app icon) into static/.
// static/fonts and static/icons are gitignored; this runs before dev/build.
import { cpSync, mkdirSync } from 'node:fs'
import { join } from 'node:path'

const here = import.meta.dir
const ext = join(here, '..', 'extension')
mkdirSync(join(here, 'static', 'fonts'), { recursive: true })
cpSync(join(ext, 'src', 'popup', 'fonts'), join(here, 'static', 'fonts'), { recursive: true })
cpSync(join(here, '..', 'fingerprints', 'icons'), join(here, 'static', 'icons'), { recursive: true })
cpSync(join(ext, 'assets', 'icon-128.png'), join(here, 'static', 'favicon.png'))
console.log('assets synced')
