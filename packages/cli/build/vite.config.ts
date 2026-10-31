import { defaultClientConditions, defineConfig } from 'vite'

// Each build holds one target's host adapter (`vite build --mode <target>`), picked through the package condition;
// any other mode (plain `vite` while developing) gets the web adapter, the default.
const ADAPTER_CONDITIONS: Record<string, string> = {
  web: 'automata-web',
  itch: 'automata-web',
  ruken: 'automata-ruken',
  tauri: 'automata-tauri',
}

export default defineConfig(({ mode }) => ({
  base: './',
  resolve: { conditions: [ADAPTER_CONDITIONS[mode] ?? 'automata-web', ...defaultClientConditions] },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    // Vite would inline an asset under 4 kB as a data: URL, which the game's loader fetches and Ruken's CSP
    // (connect-src 'self') refuses; a file from the game's own origin is what the CSP allows.
    assetsInlineLimit: 0,
  },
}))
