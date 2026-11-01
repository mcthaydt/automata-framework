import { svelte } from '@sveltejs/vite-plugin-svelte'
import { defineConfig } from 'vite'

// The suite is a static page (`index.html` and what it imports); the tests are configured in `vitest.config.ts`.
// The Studio draws figures with the figures package, which takes a few things from the content package; that package's
// entry reaches Node built-ins, so the page loads the schema and palette through a shim (see `src/shims`).
export default defineConfig({
  plugins: [svelte()],
  resolve: {
    alias: [
      {
        find: /^@mcthaydt\/automata-content$/,
        replacement: new URL('./src/shims/content-browser.ts', import.meta.url).pathname,
      },
    ],
  },
})
