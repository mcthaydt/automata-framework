import { fileURLToPath } from 'node:url'
import { worldSwatchContent } from '@automata/3d/world-content'
import { audioContent } from '@automata/audio-synth'
import { automataContent } from '@automata/content/vite'
import { cutsceneContent } from '@automata/cutscenes/content'
import { feelContent } from '@automata/feel'
import { hudContent } from '@automata/hud/content'
import {
  beatsContent,
  canonContent,
  helpContent,
  linesContent,
  storyletsContent,
} from '@automata/narrative/content'
import { navGraphContent } from '@automata/nav'
import { puzzleContent } from '@automata/puzzle'
import { systemsContent } from '@automata/systems'
import { carriedLightContent, peekContent } from '@automata/systems/sim'
import { creditsContent } from '@automata/ui-screens/content'
import { svelte } from '@sveltejs/vite-plugin-svelte'
import { defaultClientConditions, defineConfig } from 'vite'
import { lookProfilesContent } from './src/app/look-profiles.content.ts'
import { lightsOutContent } from './src/features/lamp/lights-out.content.ts'

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
    schemas: [
      linesContent,
      storyletsContent,
      beatsContent,
      helpContent,
      canonContent,
      cutsceneContent,
      navGraphContent,
      // The calls the puzzle's actions make (`read`, `fill`) are the game's; the creature's four hooks and the re-route
      // are answered by the night feature (task 12).
      puzzleContent({ calls: ['read', 'fill'], extensions: ['systems', 'narrative', 'cutscenes'] }),
      systemsContent({ hooks: ['caught', 'replan', 'stop', 'leave', 'wake', 'vigil'] }),
      // The hand lamp's and the peek's numbers, the play HUD's file and the sound: each is a file a person edits, and a file of a
      // kind nobody registered is skipped without a word.
      carriedLightContent,
      peekContent,
      hudContent,
      audioContent,
      feelContent,
      creditsContent,
      // The lamps' levels once the lights have gone: the picture's, not the sim's.
      lightsOutContent,
      // The picture's two passes: the retro grade and the LCD panel, the old game's numbers.
      lookProfilesContent,
      // The game's own swatches, beside the world kit's: the clinic's plaster.
      worldSwatchContent,
    ],
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
