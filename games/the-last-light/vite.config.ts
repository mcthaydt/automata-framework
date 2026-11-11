import { fileURLToPath } from 'node:url'
import { automataContent } from '@automata/content/vite'
import { svelte } from '@sveltejs/vite-plugin-svelte'
import { defaultClientConditions, defineConfig } from 'vite'

// Each build holds one target's host adapter (`vite build --mode <target>`), picked through the package condition;
// any other mode (plain `vite` while developing) gets the web adapter, the default. The targets are peers (ADR 0006).
const ADAPTER_CONDITIONS: Record<string, string> = {
  web: 'automata-web',
  itch: 'automata-web',
}

/**
 * The content plugin over the game's `content/` (`virtual:automata/content`). The page and the tests (vitest.config.ts)
 * both compile it. A journey that edits content points it at a copy (`AF_E2E_CONTENT_ROOT`), so the committed files
 * are never touched.
 */
export function contentPlugin(): ReturnType<typeof automataContent> {
  return automataContent({
    root: process.env.AF_E2E_CONTENT_ROOT ?? fileURLToPath(new URL('.', import.meta.url)),
    schemas: [],
  })
}

export default defineConfig(({ mode }) => ({
  base: './',
  resolve: { conditions: [ADAPTER_CONDITIONS[mode] ?? 'automata-web', ...defaultClientConditions] },
  // The framework's screens are Svelte components, compiled with the game; the content plugin serves `content/`.
  plugins: [svelte(), contentPlugin()],
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    // Vite would inline an asset under 4 kB as a data: URL, which the game's loader fetches and a host's CSP
    // (connect-src 'self') refuses; a file from the game's own origin is what the CSP allows.
    assetsInlineLimit: 0,
  },
}))
