import type { Detection } from '@opentechcheck/core'
import registry from '@opentechcheck/fingerprints'
import type { TabResult } from '../shared/protocol'

export const CATEGORY_ORDER = [
  'js-framework', 'web-framework', 'ui-framework', 'js-library', 'cms', 'ecommerce',
  'payment', 'analytics', 'tag-manager', 'marketing', 'video', 'security', 'hosting', 'cdn',
  'server', 'database', 'language', 'misc', 'other',
]

export function grade(confidence: number): 'A' | 'B' | 'C' | 'D' {
  if (confidence >= 90) return 'A'
  if (confidence >= 75) return 'B'
  if (confidence >= 60) return 'C'
  return 'D'
}

export function groupByCategory(detections: Detection[]): Array<{ category: string; items: Detection[] }> {
  const byCategory = new Map<string, Detection[]>()
  for (const det of detections) {
    const list = byCategory.get(det.category)
    if (list) list.push(det)
    else byCategory.set(det.category, [det])
  }
  const rank = (category: string) => {
    const i = CATEGORY_ORDER.indexOf(category)
    return i === -1 ? CATEGORY_ORDER.length : i
  }
  return [...byCategory.entries()]
    .sort(([a], [b]) => rank(a) - rank(b) || a.localeCompare(b))
    .map(([category, items]) => ({
      category,
      items: [...items].sort((x, y) => y.confidence - x.confidence || x.name.localeCompare(y.name)),
    }))
}

export function stackSummary(detections: Detection[]): string {
  return groupByCategory(detections)
    .flatMap((group) => group.items)
    .map((det) => (det.version ? `${det.name} ${det.version}` : det.name))
    .join('\n')
}

export function exportPayload(result: TabResult): string {
  return JSON.stringify({
    url: result.url,
    detections: result.detections.map((det) => ({
      slug: det.slug,
      name: det.name,
      category: det.category,
      version: det.version,
      confidence: det.confidence,
      grade: grade(det.confidence),
      evidence: det.evidence,
    })),
  }, null, 2)
}

const sites = new Map((registry as Array<{ slug: string; website: string }>).map((f) => [f.slug, f.website]))

export const websiteOf = (slug: string): string | undefined => sites.get(slug)

// Stable catalog number: 1-based position in the slug-sorted registry.
const codes = new Map(
  (registry as Array<{ slug: string }>).map((f, i) => [f.slug, String(i + 1).padStart(3, '0')]),
)

const CATEGORY_SHORT: Record<string, string> = {
  'js-framework': 'JS-FW', 'web-framework': 'WEB-FW', 'js-library': 'JS-LIB',
  'ui-framework': 'UI-FW', cms: 'CMS', ecommerce: 'ECOM', payment: 'PAY',
  analytics: 'AN', 'tag-manager': 'TAG', marketing: 'MKT', video: 'VID',
  security: 'SEC', hosting: 'HOST', cdn: 'CDN', server: 'SRV', database: 'DB',
  language: 'LANG', misc: 'MISC', other: 'OTHER',
}

export const codeOf = (slug: string): string => `OTC ${codes.get(slug) ?? '000'}`
export const categoryShort = (category: string): string => CATEGORY_SHORT[category] ?? category.toUpperCase()
export const categoryLabel = (category: string): string => category.replace(/-/g, ' ')
