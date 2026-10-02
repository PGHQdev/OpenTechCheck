import { expect, test } from 'bun:test'
import { join } from 'node:path'
import { CATEGORY_ORDER as EXTENSION_ORDER, categoryLabel as extensionLabel } from '../../extension/src/popup/format'
import { CATEGORY_ORDER, categoryLabel, groupByCategory } from '../src/lib/catalog'
import { scanRegistry } from '../src/lib/registry'

const registry = join(import.meta.dir, '..', '..', '..', 'packages', 'fingerprints', 'src', 'registry')

test('category order and labels match the extension popup', () => {
  expect(CATEGORY_ORDER).toEqual(EXTENSION_ORDER)
  for (const category of CATEGORY_ORDER) expect(categoryLabel(category)).toBe(extensionLabel(category))
})

test('every registry technology appears once under a known category', () => {
  const techs = scanRegistry(registry)
  const groups = groupByCategory(techs)
  const listed = groups.flatMap((group) => group.items.map((tech) => tech.slug))
  expect(listed.length).toBe(techs.length)
  expect(new Set(listed).size).toBe(techs.length)
  for (const group of groups) {
    expect(CATEGORY_ORDER).toContain(group.category)
    for (const tech of group.items) {
      expect(tech.category).toBe(group.category)
      expect(tech.path).toBe(`${tech.category}/${tech.slug}.yaml`)
      expect(tech.name.length).toBeGreaterThan(0)
    }
  }
  const ranks = groups.map((group) => CATEGORY_ORDER.indexOf(group.category))
  expect(ranks).toEqual([...ranks].sort((a, b) => a - b))
})
