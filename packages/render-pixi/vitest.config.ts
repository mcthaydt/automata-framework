import { defineTests } from '@mcthaydt/vitest-preset'
import { svelte } from '@sveltejs/vite-plugin-svelte'

// jsdom for the unit tests; the browser tests (parity) draw on a real renderer in three engines.
export default defineTests({ environment: 'jsdom', plugins: [svelte()] })
