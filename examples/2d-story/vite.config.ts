import { audioContent } from '@automata/audio-synth'
import { controlsKind } from '@automata/content/controls'
import { level2dKinds } from '@automata/content/level-2d'
import { automataContent } from '@automata/content/vite'
import { cutsceneContent } from '@automata/cutscenes/content'
import { feelContent } from '@automata/feel'
import { dialogueContent, linesContent } from '@automata/narrative/content'
import { navGraphContent } from '@automata/nav'
import { systemsContent } from '@automata/systems'
import { svelte } from '@sveltejs/vite-plugin-svelte'
import { defaultClientConditions, defineConfig } from 'vite'

// Each build holds one target's host adapter (`vite build --mode <target>`), picked through the package condition;
// any other mode (plain `vite` while developing) gets the web adapter, the default.
const ADAPTER_CONDITIONS: Record<string, string> = {
  web: 'automata-web',
  itch: 'automata-web',
}

export default defineConfig(({ mode }) => ({
  base: './',
  resolve: { conditions: [ADAPTER_CONDITIONS[mode] ?? 'automata-web', ...defaultClientConditions] },
  // The framework's screens are Svelte components, compiled with the game. The content plugin compiles `content/`
  // (the level the editor writes, the keeper's words, the cutscene and the guard) into `virtual:automata/content`,
  // again on every save while `pnpm dev` runs.
  plugins: [
    svelte(),
    automataContent({
      schemas: [
        ...level2dKinds(),
        controlsKind(),
        linesContent,
        dialogueContent,
        cutsceneContent,
        navGraphContent,
        systemsContent({ hooks: [] }),
        feelContent,
        audioContent,
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
