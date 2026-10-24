import { svelte } from '@sveltejs/vite-plugin-svelte'
import { defineConfig } from 'vite'

// The editor is a static page (`index.html` and what it imports); the tests are configured in `vitest.config.ts`.
// Nothing else is set here: a client build already resolves modules under the `browser` condition, and a Node test
// project that read it would load the browser build of the code parser.
export default defineConfig({ plugins: [svelte()] })
