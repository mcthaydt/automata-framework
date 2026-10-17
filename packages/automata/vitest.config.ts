import { svelte } from '@sveltejs/vite-plugin-svelte'
import { defineConfig } from 'vitest/config'

// The umbrella's surface, in jsdom: it re-exports the game package, whose default screens are Svelte components
// with CSS, so the Svelte plugin compiles them and Svelte resolves its client build.
export default defineConfig({
  plugins: [svelte()],
  resolve: { conditions: ['browser'] },
  test: {
    environment: 'jsdom',
    include: ['src/**/*.test.ts'],
    css: true,
  },
})
