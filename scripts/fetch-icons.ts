// Build-time favicon fetch: one icon per fingerprint, derived from its
// `website` field via Google's favicon cache (direct /favicon.ico fallback).
// Icons are committed; the extension bundles them so runtime stays offline.
// Usage: bun run scripts/fetch-icons.ts [slug ...]   (no args = all missing)
import { existsSync, mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { compile } from '../packages/fingerprints/src/compile'

const ICONS = join(import.meta.dir, '..', 'packages', 'fingerprints', 'icons')
mkdirSync(ICONS, { recursive: true })

const { fingerprints, errors } = compile(join(import.meta.dir, '..', 'packages', 'fingerprints', 'src', 'registry'))
if (errors.length > 0) { console.error(errors); process.exit(1) }

async function fetchBytes(url: string): Promise<Uint8Array | null> {
  try {
    const res = await fetch(url, { redirect: 'follow', signal: AbortSignal.timeout(10_000) })
    if (!res.ok) return null
    return new Uint8Array(await res.arrayBuffer())
  } catch { return null }
}

// Google serves a generic globe for unknown domains; hash it once so those
// misses fall through to the monogram fallback instead of shipping a globe.
const DEFAULT = await fetchBytes('https://www.google.com/s2/favicons?domain=no-such-domain-otc-probe.example&sz=64')
const defaultHash = DEFAULT ? Bun.hash(DEFAULT).toString() : ''

const only = new Set(process.argv.slice(2))
let ok = 0, skipped = 0, missing: string[] = []

for (const fp of fingerprints) {
  if (only.size > 0 && !only.has(fp.slug)) continue
  const out = join(ICONS, `${fp.slug}.png`)
  if (only.size === 0 && existsSync(out)) { skipped++; continue }
  const host = new URL(fp.website).hostname
  let bytes = await fetchBytes(`https://www.google.com/s2/favicons?domain=${host}&sz=64`)
  if (bytes && Bun.hash(bytes).toString() === defaultHash) bytes = null
  if (!bytes) {
    const direct = await fetchBytes(new URL('/favicon.ico', fp.website).href)
    // .ico is fine for <img>; keep the .png name for a uniform lookup scheme
    if (direct && direct.length > 0) bytes = direct
  }
  if (!bytes) { missing.push(fp.slug); continue }
  writeFileSync(out, bytes)
  ok++
  console.log(`✓ ${fp.slug} (${bytes.length}b)`)
}

console.log(`\nfetched ${ok}, kept ${skipped}, missing ${missing.length}`)
if (missing.length > 0) console.log('monogram fallback will cover:', missing.join(', '))
