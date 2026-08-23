import { readdirSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vite'
import { svelte } from '@sveltejs/vite-plugin-svelte'
import tailwindcss from '@tailwindcss/vite'
import { jsPaths, domSelectors } from './build/generate-lists'
import type { Fingerprint } from '@opentechcheck/core'
import registry from '@opentechcheck/fingerprints'
import type { Plugin } from 'vite'

const fps = registry as unknown as Fingerprint[]

function iconSlugs(): string[] {
  // import.meta.url survives vite's config bundling; import.meta.dir does not.
  const here = dirname(fileURLToPath(import.meta.url))
  const dir = join(here, '..', 'fingerprints', 'icons')
  const slugs = readdirSync(dir).filter((f) => f.endsWith('.png')).map((f) => f.slice(0, -4))
  if (slugs.length === 0) throw new Error(`no icons found at ${dir} — run scripts/fetch-icons.ts`)
  return slugs
}

export function listsPlugin(): Plugin {
  return {
    name: 'opentechcheck-lists',
    resolveId: (id) => (id === 'virtual:lists' ? '\0virtual:lists' : undefined),
    load: (id) =>
      id === '\0virtual:lists'
        ? `export const JS_PATHS = ${JSON.stringify(jsPaths(fps))};\n` +
          `export const DOM_SELECTORS = ${JSON.stringify(domSelectors(fps))};\n` +
          `export const ICON_SLUGS = ${JSON.stringify(iconSlugs())};`
        : undefined,
  }
}

// entry is selected by build.ts via --mode; each script entry builds as a
// single-file IIFE (content scripts and the Firefox event page are classic scripts)
export default defineConfig(({ mode }) => {
  const outDir = process.env.OTC_OUTDIR ?? 'dist/chrome'
  if (mode === 'popup') {
    return {
      plugins: [svelte(), tailwindcss(), listsPlugin()],
      base: './',
      build: {
        outDir, emptyOutDir: false,
        rollupOptions: {
          input: 'src/popup/popup.html',
          output: {
            entryFileNames: 'popup.js',
            // css keeps the flat popup.css name; fonts keep their own names
            assetFileNames: (info) =>
              info.names?.[0]?.endsWith('.css') ? 'popup[extname]' : '[name][extname]',
          },
        },
      },
    }
  }
  const entries: Record<string, string> = {
    background: 'src/background/index.ts',
    content: 'src/content/index.ts',
    'main-world': 'src/main-world/index.ts',
  }
  return {
    plugins: [listsPlugin()],
    build: {
      outDir, emptyOutDir: false,
      lib: { entry: entries[mode]!, formats: ['iife'], name: 'otc', fileName: () => `${mode}.js` },
    },
  }
})
