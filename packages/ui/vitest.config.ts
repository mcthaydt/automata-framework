import { defineTests } from '@mcthaydt/vitest-preset'
import { svelteTesting } from '@testing-library/svelte/vite'

// unit: logic and component behavior in jsdom, through Testing Library (states and behavior, no snapshots).
// browser: layout contracts with production CSS in real Chromium, WebKit and Firefox at every reference size.
export default defineTests({
  environment: 'jsdom',
  // Svelte's client build, so components mount.
  svelte: true,
  plugins: [svelteTesting()],
  // Real CSS, so the theme test reads theme.css and components carry their styles.
  css: true,
  setupFiles: ['./tests/setup.ts'],
})
