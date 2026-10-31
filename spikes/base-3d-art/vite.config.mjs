// The art spike (TDD-exempt, spikes/): served from the base-3d game's dependencies, so nothing is installed here.
import { realpathSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

const at = (path) => realpathSync(fileURLToPath(new URL(path, import.meta.url)))
const game = '../../games/base-3d/node_modules/'
export default {
  root: at('.'),
  base: './',
  resolve: {
    alias: [
      { find: /^@pixi\/3d$/, replacement: `${at(`${game}@pixi/3d`)}/dist/index.mjs` },
      { find: /^pixi\.js$/, replacement: `${at(`${game}pixi.js`)}/lib/index.mjs` },
      {
        find: /^@mcthaydt\/automata-render-pixi3d\/no-eval$/,
        replacement: at('../../packages/render-pixi3d/src/no-eval.ts'),
      },
    ],
  },
  build: { outDir: at('..') + '/out/base-3d-art', emptyOutDir: true },
}
