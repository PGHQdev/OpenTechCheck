// Category order and labels match apps/extension/src/popup/format.ts;
// test/catalog.test.ts keeps them in sync.
export const CATEGORY_ORDER = [
  'js-framework', 'web-framework', 'ui-framework', 'js-library', 'cms', 'plugin', 'ecommerce',
  'booking', 'payment', 'analytics', 'tag-manager', 'marketing', 'live-chat', 'crm',
  'video', 'security', 'consent', 'hosting', 'cdn', 'server', 'database',
  'language', 'misc', 'other',
]

export const categoryLabel = (category: string): string => category.replace(/-/g, ' ')

export interface Tech {
  slug: string
  name: string
  category: string
  website?: string
  path: string
}

export function groupByCategory(techs: Tech[]): Array<{ category: string; items: Tech[] }> {
  const byCategory = new Map<string, Tech[]>()
  for (const tech of techs) {
    const list = byCategory.get(tech.category)
    if (list) list.push(tech)
    else byCategory.set(tech.category, [tech])
  }
  const rank = (category: string) => {
    const i = CATEGORY_ORDER.indexOf(category)
    return i === -1 ? CATEGORY_ORDER.length : i
  }
  return [...byCategory.entries()]
    .sort(([a], [b]) => rank(a) - rank(b) || a.localeCompare(b))
    .map(([category, items]) => ({
      category,
      items: [...items].sort((x, y) => x.name.localeCompare(y.name, 'en', { sensitivity: 'base' })),
    }))
}
