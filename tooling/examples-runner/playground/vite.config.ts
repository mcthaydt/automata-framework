import { execFileSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { svelte } from '@sveltejs/vite-plugin-svelte'
import { defineConfig } from 'vite'
import { PLAYGROUND_ENTRIES } from '../src/playground/vite-runtime.ts'

// The playground runtime (website playground spec §5.5): one build of the umbrella, Zod and the frame script, so
// everything an example and its frame load is one copy. Content-hashed names; Vite's manifest says which file is
// which. The frame reports the framework commit it was built from.
const packageRoot = fileURLToPath(new URL('..', import.meta.url))
const commit = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: packageRoot, encoding: 'utf8' }).trim()

export default defineConfig({
  root: packageRoot,
  plugins: [svelte()],
  define: { __AF_FRAMEWORK_COMMIT__: JSON.stringify(commit) },
  logLevel: 'warn',
  build: {
    outDir: 'playground/dist/runtime',
    emptyOutDir: true,
    manifest: true,
    target: 'es2022',
    modulePreload: false,
    rolldownOptions: {
      input: {
        automata: PLAYGROUND_ENTRIES.automata,
        zod: PLAYGROUND_ENTRIES.zod,
        frame: PLAYGROUND_ENTRIES.frame,
      },
      // The entries' exports are what the import map hands the example; nothing may be shaken out of them.
      preserveEntrySignatures: 'strict',
    },
  },
})
