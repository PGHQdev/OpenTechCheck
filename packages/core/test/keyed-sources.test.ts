import { expect, test } from 'bun:test'
import { detect } from '../src/index'
import type { Fingerprint } from '../src/index'

const cf: Fingerprint = {
  name: 'Cloudflare', slug: 'cloudflare', category: 'cdn', website: 'https://www.cloudflare.com',
  detect: {
    headers: {
      server: [{ pattern: 'cloudflare' }],
      'cf-ray': [{ pattern: '' }],
    },
  },
}

const wp: Fingerprint = {
  name: 'WordPress', slug: 'wordpress', category: 'cms', website: 'https://wordpress.org',
  detect: { meta: { generator: [{ pattern: 'WordPress' }] } },
}

const shop: Fingerprint = {
  name: 'Shopify', slug: 'shopify', category: 'ecommerce', website: 'https://www.shopify.com',
  detect: { cookies: { _shopify_s: [{ pattern: '' }] } },
}

const react: Fingerprint = {
  name: 'React', slug: 'react', category: 'js-framework', website: 'https://react.dev',
  detect: {
    js: { 'React.version': [{ pattern: '.' }] },
    dom: { '[data-reactroot]': [{ pattern: '' }] },
  },
}

test('header value pattern and header presence', () => {
  const out = detect({ url: 'u', headers: { server: ['cloudflare'], 'cf-ray': ['abc'] } }, [cf])
  expect(out[0]?.evidence.map((e) => e.key).sort()).toEqual(['cf-ray', 'server'])
})

test('meta generator', () => {
  const out = detect({ url: 'u', meta: { generator: ['WordPress 6.5'] } }, [wp])
  expect(out[0]?.slug).toBe('wordpress')
})

test('cookie presence', () => {
  expect(detect({ url: 'u', cookies: { _shopify_s: 'x' } }, [shop])[0]?.slug).toBe('shopify')
})

test('js global and dom selector', () => {
  const out = detect({ url: 'u', js: { 'React.version': '18.3.1' }, dom: ['[data-reactroot]'] }, [react])
  expect(out[0]?.evidence).toHaveLength(2)
})

test('keyed source with missing key does not match', () => {
  expect(detect({ url: 'u', headers: {} }, [cf])).toHaveLength(0)
})
