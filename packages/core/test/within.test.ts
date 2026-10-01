import { expect, test } from 'bun:test'
import { detect } from '../src/index'
import type { Fingerprint } from '../src/index'

const fp = (slug: string, category: string, extra: Partial<Fingerprint> = {}): Fingerprint => ({
  name: slug, slug, category, website: 'https://x.com', detect: { html: [{ pattern: `${slug}-mark` }] }, ...extra,
})
const shopify = fp('shopify', 'ecommerce')
const shopware = fp('shopware', 'ecommerce')
const blog = fp('blog', 'cms')
const app = fp('app', 'marketing', { within: { techs: ['shopify', 'shopware'] } })
const widget = fp('widget', 'marketing', { within: { categories: ['ecommerce'] } })
const slugs = (html: string, fps: Fingerprint[]) => detect({ url: 'u', html }, fps).map((d) => d.slug).sort()

test('closed gate: the gated fingerprint is not evaluated', () => {
  expect(slugs('app-mark', [shopify, app])).toEqual([])
})

test('a listed tech opens the gate', () => {
  expect(slugs('shopify-mark app-mark', [shopify, app])).toEqual(['app', 'shopify'])
})

test('any one of several listed techs opens the gate', () => {
  expect(slugs('shopware-mark app-mark', [shopify, shopware, app])).toEqual(['app', 'shopware'])
})

test('a listed category opens the gate', () => {
  expect(slugs('shopware-mark widget-mark', [shopware, widget])).toEqual(['shopware', 'widget'])
  expect(slugs('blog-mark widget-mark', [blog, widget])).toEqual(['blog'])
})

test('techs and categories combine as any', () => {
  const both = fp('both', 'marketing', { within: { techs: ['blog'], categories: ['ecommerce'] } })
  expect(slugs('blog-mark both-mark', [blog, both])).toEqual(['blog', 'both'])
  expect(slugs('shopify-mark both-mark', [shopify, both])).toEqual(['both', 'shopify'])
})

test('a chain of gated fingerprints', () => {
  const addon = fp('addon', 'marketing', { within: { techs: ['app'] } })
  expect(slugs('shopify-mark app-mark addon-mark', [addon, app, shopify])).toEqual(['addon', 'app', 'shopify'])
})

test('a tech implied into the context opens a gate', () => {
  const theme = fp('theme', 'other', { implies: ['shopify'] })
  expect(slugs('theme-mark app-mark', [shopify, theme, app])).toEqual(['app', 'shopify', 'theme'])
})

test('implies adds a gated tech even with its gate closed', () => {
  const kit = fp('kit', 'other', { implies: ['app'] })
  expect(slugs('kit-mark', [shopify, kit, app])).toEqual(['app', 'kit'])
})

test('a gated tech stays when excludes removes its context tech', () => {
  const rival = fp('rival', 'ecommerce', { excludes: ['shopify'] })
  expect(slugs('shopify-mark rival-mark app-mark', [rival, shopify, app])).toEqual(['app', 'rival'])
})
