import { join } from 'node:path'

export function serveFixture(port: number) {
  return Bun.serve({
    port,
    fetch(req) {
      const path = new URL(req.url).pathname
      if (path === '/' || path === '/index.html') {
        return new Response(Bun.file(join(import.meta.dir, 'fixture', 'index.html')), {
          headers: { 'content-type': 'text/html', server: 'nginx/1.25.0' },
        })
      }
      return new Response('// stub', { headers: { 'content-type': 'text/javascript' } })
    },
  })
}
