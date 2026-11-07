// Builds a fixture entry with Vite, in memory, so the release bundle test (DB-b) reads the real output.
import { fileURLToPath } from 'node:url'
import { svelte } from '@sveltejs/vite-plugin-svelte'
import { build, type Rolldown } from 'vite'
import { debugBuild } from '../vite'

export const OVERLAY_MARKER = 'automata-debug-overlay'
export const DRIVER_MARKER = '__automataDebug'

export async function bundle(entry: 'guarded' | 'leaky', debug: boolean): Promise<string> {
  const result = await build({
    configFile: false,
    logLevel: 'silent',
    plugins: [svelte({ compilerOptions: { css: 'injected' } }), debugBuild(debug)],
    build: {
      write: false,
      minify: false,
      lib: { entry: fileURLToPath(new URL(`./bundle/${entry}.ts`, import.meta.url)), formats: ['es'] },
      rollupOptions: { external: [/^@mcthaydt\//, /^effect/, 'svelte', /^svelte\//] },
    },
  })
  const outputs = (Array.isArray(result) ? result : [result]) as Rolldown.RolldownOutput[]
  return outputs.flatMap((o) => o.output.map((chunk) => ('code' in chunk ? chunk.code : ''))).join('\n')
}
