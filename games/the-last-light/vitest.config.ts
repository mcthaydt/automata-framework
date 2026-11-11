import { defineTests } from '@automata/vitest-preset'
import { contentPlugin } from './vite.config.ts'

// Node runs every unit test (a DOM test says `jsdom` on its first line). Svelte compiles the framework's screens the
// game imports, and the content plugin compiles `content/` as the page does.
export default defineTests({
  svelte: true,
  plugins: [contentPlugin()],
  optimizeDeps: ['koota', 'zod', 'pixi.js'],
})
