import { mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { collect } from '@opentechcheck/collect-http'

const [url, slug, name] = process.argv.slice(2)
if (!url || !slug) {
  console.error('usage: bun run capture <url> <slug> [fixture-name]')
  process.exit(1)
}
const result = await collect(url)
if (!result.ok) {
  console.error(`${result.error.code}: ${result.error.message}`)
  process.exit(1)
}
const fixtureName = name ?? new URL(result.bundle.url).hostname.replace(/\./g, '-')
const dir = join(import.meta.dir, '..', 'fixtures', slug)
mkdirSync(dir, { recursive: true })
writeFileSync(join(dir, `${fixtureName}.bundle.json`), JSON.stringify(result.bundle, null, 2))
const expectedPath = join(dir, `${fixtureName}.expected.json`)
writeFileSync(expectedPath, JSON.stringify({ detects: [slug] }, null, 2))
console.log(`wrote fixtures/${slug}/${fixtureName}.bundle.json`)
console.log(`edit ${expectedPath} to list every slug this bundle should detect`)
