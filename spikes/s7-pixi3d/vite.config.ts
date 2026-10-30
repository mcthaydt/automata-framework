import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vite'

// Spike S7's pages. render-pixi's no-eval, renderer and delta consumer are imported from their source in
// packages/render-pixi (the real modules, not copies); `dedupe` resolves their `pixi.js` and `zod` from this
// folder, so the page has one pixi.js, 8.22.0, the version @pixi/3d's peer asks for (core is on 8.21 until M3.2).
// The runtime is aliased to the two values render-pixi's renderer imports from it (src/mount/runtime-values.ts),
// and the ui package to its form-factor module, so the page does not bundle Svelte.
//
// S7_VARIANT=webgl-only builds the scene with @pixi/3d's WebGPU backend loader stubbed out, which is what a
// game that imports `@pixi/3d/webgl` alone would ship (S7-Q7).
const at = (path: string) => fileURLToPath(new URL(path, import.meta.url))
const webglOnly = process.env.S7_VARIANT === 'webgl-only'

export default defineConfig({
  base: './',
  resolve: {
    dedupe: ['effect', 'pixi.js', 'zod'],
    alias: [
      {
        find: '@mcthaydt/automata-render-pixi/no-eval',
        replacement: at('../../packages/render-pixi/src/no-eval.ts'),
      },
      {
        find: '@mcthaydt/automata-render-pixi/renderer',
        replacement: at('../../packages/render-pixi/src/renderer.ts'),
      },
      {
        find: '@mcthaydt/automata-render-pixi/delta',
        replacement: at('../../packages/render-pixi/src/delta/render-delta-consumer.ts'),
      },
      { find: '@mcthaydt/automata-runtime', replacement: at('./src/mount/runtime-values.ts') },
      { find: '@mcthaydt/automata-ui', replacement: at('../../packages/ui/src/geometry/form-factor.ts') },
      {
        find: '#pixi-unsafe-eval/uniforms',
        replacement: at('./node_modules/pixi.js/lib/unsafe-eval/uniforms/uniformSyncFunctions.mjs'),
      },
      {
        find: '#pixi-unsafe-eval/ubo',
        replacement: at('./node_modules/pixi.js/lib/unsafe-eval/ubo/uboSyncFunctions.mjs'),
      },
      ...(webglOnly
        ? [{ find: /^\.\/core\/gpu\/init\.mjs$/, replacement: at('./src/mount/no-backend.ts') }]
        : []),
    ],
  },
  server: { fs: { allow: [at('../..')] } },
  build: {
    outDir: process.env.S7_OUT ?? 'dist',
    emptyOutDir: true,
    manifest: true,
    rollupOptions: {
      input: {
        main: at('./index.html'),
        shim: at('./index-shim.html'),
        no3d: at('./no3d.html'),
        extras: at('./extras.html'),
      },
    },
  },
})
