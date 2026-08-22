import { defineConfig } from 'vite'
import { svelte } from '@sveltejs/vite-plugin-svelte'
import tailwindcss from '@tailwindcss/vite'
import { jsPaths, domSelectors } from './build/generate-lists'
import type { Fingerprint } from '@opentechcheck/core'
import registry from '@opentechcheck/fingerprints'
import type { Plugin } from 'vite'

const fps = registry as unknown as Fingerprint[]

export function listsPlugin(): Plugin {
  return {
    name: 'opentechcheck-lists',
    resolveId: (id) => (id === 'virtual:lists' ? '\0virtual:lists' : undefined),
    load: (id) =>
      id === '\0virtual:lists'
        ? `export const JS_PATHS = ${JSON.stringify(jsPaths(fps))};\n` +
          `export const DOM_SELECTORS = ${JSON.stringify(domSelectors(fps))};`
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
          output: { entryFileNames: 'popup.js', assetFileNames: 'popup[extname]' },
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
