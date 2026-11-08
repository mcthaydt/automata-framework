import { figuresExtension } from '@automata/3d/figures'
import { worldPropContent, worldSwatchContent } from '@automata/3d/world-content'
import { automataContent } from '@automata/content/vite'
import { debugBuild } from '@automata/debug/vite'
import { navGraphContent } from '@automata/nav'
import { puzzleContent } from '@automata/puzzle'
import { systemsContent } from '@automata/systems'
import { svelte } from '@sveltejs/vite-plugin-svelte'
import { defaultClientConditions, defineConfig } from 'vite'

// Each build holds one target's host adapter (`vite build --mode <target>`), picked through the package condition;
// any other mode (plain `vite` while developing) gets the web adapter, the default.
const ADAPTER_CONDITIONS: Record<string, string> = {
  web: 'automata-web',
  itch: 'automata-web',
}

export default defineConfig(({ mode, command }) => ({
  base: './',
  resolve: { conditions: [ADAPTER_CONDITIONS[mode] ?? 'automata-web', ...defaultClientConditions] },
  // The framework's screens are Svelte components, compiled with the game. The content plugin compiles `content/`
  // (Wick's figure, the hall's swatches and props, the tuning, and the guard, its places and the puzzle) into `virtual:automata/content`, again on every save while `pnpm dev` runs.
  plugins: [
    svelte(),
    automataContent({
      schemas: [
        ...(figuresExtension.content ?? []),
        worldSwatchContent,
        worldPropContent,
        navGraphContent,
        puzzleContent({ calls: [], extensions: ['systems'] }),
        systemsContent({ hooks: [] }),
      ],
    }),
  ],
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    // Vite would inline an asset under 4 kB as a data: URL, which the game's loader fetches and Ruken's CSP
    // (connect-src 'self') refuses; a file from the game's own origin is what the CSP allows.
    assetsInlineLimit: 0,
  },
}))
