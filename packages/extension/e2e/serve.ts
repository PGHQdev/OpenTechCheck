import { join } from 'node:path'

export async function buildFrameworkFixture(): Promise<string> {
  const result = await Bun.build({
    entrypoints: [join(import.meta.dir, 'fixture', 'runtime-frameworks.js')],
    target: 'browser', minify: true, define: { 'process.env.NODE_ENV': '"production"' },
  })
  if (!result.success) throw new Error(result.logs.join('\n'))
  return result.outputs[0]!.text()
}

export function serveFixture(port: number, frameworkBundle = '') {
  return Bun.serve({
    port,
    fetch(req) {
      const path = new URL(req.url).pathname
      if (path === '/runtime-frameworks.js') return new Response(frameworkBundle, { headers: { 'content-type': 'text/javascript' } })
      if (path === '/frameworks') return new Response(
        '<!doctype html><html><head><title>Production framework probes</title></head><body>' +
        '<div>Unrelated content</div>'.repeat(6000) +
        '<div id="preact-fixture"></div><div id="alpine-fixture"></div><div id="lit-fixture"></div>' +
        '<script src="/runtime-frameworks.js"></script></body></html>',
        { headers: { 'content-type': 'text/html' } },
      )
      if (path === '/' || path === '/index.html') {
        return new Response(Bun.file(join(import.meta.dir, 'fixture', 'index.html')), {
          headers: { 'content-type': 'text/html', server: 'nginx/1.25.0' },
        })
      }
      return new Response('// stub', { headers: { 'content-type': 'text/javascript' } })
    },
  })
}
