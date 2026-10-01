import { expect, test } from 'bun:test'
import { detect } from '../src/index'
import type { Fingerprint } from '../src/index'

const shop: Fingerprint = {
  name: 'Shop', slug: 'shop', category: 'ecommerce', website: 'https://x.com',
  detect: { url: [{ pattern: '\\.myshop\\.com/v([\\d.]+)/', version: 1 }] },
}

test('url rule matches bundle.url with version and evidence', () => {
  const [d] = detect({ url: 'https://a.myshop.com/v2.1/cart' }, [shop])
  expect(d?.version).toBe('2.1')
  expect(d?.evidence).toEqual([{ source: 'url', pattern: shop.detect.url![0]!.pattern, match: '.myshop.com/v2.1/' }])
})

test('url rule with no match', () => {
  expect(detect({ url: 'https://example.com/' }, [shop])).toHaveLength(0)
})
