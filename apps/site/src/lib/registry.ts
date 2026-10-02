// Reads the fingerprint registry at build time (Bun only; used by sync-assets and tests).
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { Glob } from 'bun'
import type { Tech } from './catalog'

export function scanRegistry(dir: string): Tech[] {
  return [...new Glob('**/*.yaml').scanSync(dir)].sort().map((path) => {
    const rule = Bun.YAML.parse(readFileSync(join(dir, path), 'utf8')) as Record<string, unknown>
    const tech: Tech = { slug: String(rule.slug), name: String(rule.name), category: String(rule.category), path }
    if (typeof rule.website === 'string' && rule.website) tech.website = rule.website
    return tech
  })
}
