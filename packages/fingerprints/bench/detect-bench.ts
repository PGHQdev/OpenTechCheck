import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { performance } from 'node:perf_hooks'
import { detect, type Fingerprint, type SignalBundle } from '@opentechcheck/core'
import { compile } from '../src/compile'

// Paths resolve from the working directory, so Node runs a bundled copy the same way.
const REGISTRY = resolve('packages/fingerprints/src/registry')
const FIXTURES = process.env.OTC_FIXTURES ? resolve(process.env.OTC_FIXTURES) : undefined
const RUNS = 5

function fail(message: string, code: number): never {
  console.error(message)
  process.exit(code)
}

const scaleAt = process.argv.indexOf('--scale')
const scale = scaleAt >= 0 ? Number(process.argv[scaleAt + 1]) : 1
if (!Number.isInteger(scale) || scale < 1) fail('--scale takes an integer >= 1', 2)
if (FIXTURES === undefined || !existsSync(FIXTURES)) fail('set OTC_FIXTURES to the fixture directory', 2)

// Copy i keeps the original slugs for i = 0 and adds -s<i> after, so references stay inside a copy.
function scaled(fps: Fingerprint[], n: number): Fingerprint[] {
  const out: Fingerprint[] = []
  for (let i = 0; i < n; i++) {
    const rename = (slug: string) => (i === 0 ? slug : `${slug}-s${i}`)
    for (const fp of fps) {
      const copy = structuredClone(fp)
      copy.slug = rename(fp.slug)
      if (copy.implies) copy.implies = copy.implies.map(rename)
      if (copy.excludes) copy.excludes = copy.excludes.map(rename)
      if (copy.within?.techs) copy.within.techs = copy.within.techs.map(rename)
      out.push(copy)
    }
  }
  return out
}

interface Page { name: string; bundle: SignalBundle; expected: string[] }

function pages(dir: string): Page[] {
  const out: Page[] = []
  for (const slug of readdirSync(dir, { withFileTypes: true }).filter((e) => e.isDirectory()).map((e) => e.name).sort()) {
    for (const file of readdirSync(join(dir, slug)).sort()) {
      if (!file.endsWith('.bundle.json') || file === 'synthetic.bundle.json') continue
      const bundle = JSON.parse(readFileSync(join(dir, slug, file), 'utf8')) as SignalBundle
      const expectedPath = join(dir, slug, file.replace('.bundle.json', '.expected.json'))
      const { detects } = JSON.parse(readFileSync(expectedPath, 'utf8')) as { detects: string[] }
      out.push({ name: `${slug}/${file}`, bundle, expected: [...detects].sort() })
    }
  }
  return out
}

const median = (xs: number[]) => [...xs].sort((a, b) => a - b)[Math.floor(xs.length / 2)]!
const percentile = (sorted: number[], p: number) => sorted[Math.max(0, Math.ceil((p / 100) * sorted.length) - 1)]!

const { fingerprints: registry, errors } = compile(REGISTRY)
if (errors.length > 0) fail(errors.join('\n'), 2)
const fingerprints = scaled(registry, scale)
const warnings: string[] = []
const options = { onWarning: (m: string) => warnings.push(m) }

const times: Array<{ name: string; ms: number }> = []
const diffs: string[] = []
for (const page of pages(FIXTURES)) {
  const got = detect(page.bundle, fingerprints, options).map((d) => d.slug).sort()
  if (scale === 1 && JSON.stringify(got) !== JSON.stringify(page.expected)) {
    diffs.push(`${page.name}: expected ${page.expected.join(',')} got ${got.join(',')}`)
  }
  const runs: number[] = []
  for (let r = 0; r < RUNS; r++) {
    const start = performance.now()
    detect(page.bundle, fingerprints, options)
    runs.push(performance.now() - start)
  }
  times.push({ name: page.name, ms: median(runs) })
}

const sorted = times.map((t) => t.ms).sort((a, b) => a - b)
const slowest = times.reduce((a, b) => (b.ms > a.ms ? b : a))
const runtime = process.versions.bun ? `bun ${process.versions.bun}` : `node ${process.versions.node}`
console.log(
  `${runtime} v8=${process.versions.v8} scale=${scale} fingerprints=${fingerprints.length} pages=${times.length} ` +
  `p50=${percentile(sorted, 50).toFixed(2)}ms p95=${percentile(sorted, 95).toFixed(2)}ms ` +
  `max=${slowest.ms.toFixed(2)}ms (${slowest.name})`,
)
for (const d of diffs) console.error(`DIFF ${d}`)
for (const w of new Set(warnings)) console.error(`WARN ${w}`)
if (diffs.length > 0 || warnings.length > 0) process.exit(1)
