import { expect, test } from 'bun:test'
import { detect } from '../src/index'
import { pageText } from '../src/text'
import type { Fingerprint } from '../src/index'

test('drops comments and raw-text element contents', () => {
  const html = '<p>a<!-- x -->b</p><script>var s = "<p>no</p>"</script><STYLE>x{}</STYLE>' +
    '<noscript>n</noscript><template>t</template><p>c</p>'
  expect(pageText(html)).toBe('ab c')
})

test('each tag becomes a space; a lone < stays text', () => {
  expect(pageText('<p>one</p><p>two</p>3 < 4')).toBe('one two 3 < 4')
})

test('decodes numeric and listed named references only', () => {
  expect(pageText('a &amp; b &lt;&gt; &quot;&apos; &#65;&#x42; &copy; x&nbsp;y')).toBe('a & b <> "\' AB &copy; x y')
})

test('collapses whitespace and trims', () => {
  expect(pageText('  <div>\n a \t\n b </div>  ')).toBe('a b')
})

test('an unclosed script drops the rest of the html', () => {
  expect(pageText('<p>x</p><script>never closed <p>y')).toBe('x')
})

const foo: Fingerprint = {
  name: 'Foo', slug: 'foo', category: 'cms', website: 'https://x.com',
  detect: { text: [{ pattern: 'Powered by Foo ([\\d.]+)', version: 1 }] },
}

test('text rule matches page text with version and source', () => {
  const [d] = detect({ url: 'u', html: '<footer>Powered <b>by</b> Foo 3.2</footer>' }, [foo])
  expect(d?.version).toBe('3.2')
  expect(d?.evidence[0]).toEqual({ source: 'text', pattern: foo.detect.text![0]!.pattern, match: 'Powered by Foo 3.2' })
})

test('text inside a script does not match', () => {
  expect(detect({ url: 'u', html: '<script>"Powered by Foo 3.2"</script>' }, [foo])).toHaveLength(0)
})

test('no html gives no text hit', () => {
  expect(detect({ url: 'u' }, [foo])).toHaveLength(0)
})
