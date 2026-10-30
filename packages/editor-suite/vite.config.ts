import { svelte } from '@sveltejs/vite-plugin-svelte'
import { defineConfig } from 'vite'

// The suite is a static page (`index.html` and what it imports); the tests are configured in `vitest.config.ts`.
export default defineConfig({ plugins: [svelte()] })
