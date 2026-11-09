// Spike 3d-look (ADR 0007): runs base-3d's own page with a look injected into its `main.ts` by a transform, so the game's
// source is untouched. SPIKE_MODE picks the candidate: full (today), lowres, passes, bake. Not a product: spikes are exempt from TDD.
import { fileURLToPath } from 'node:url'
import { defineConfig, mergeConfig } from 'vite'
import game from '../../games/base-3d/vite.config.ts'

const MODE = process.env.SPIKE_MODE ?? 'full'
const SPIKE = fileURLToPath(new URL('./spike.ts', import.meta.url))

export default defineConfig(
  mergeConfig(game, {
    root: fileURLToPath(new URL('../../games/base-3d', import.meta.url)),
    server: { fs: { strict: false } },
    plugins: [
      {
        name: 'spike-3d-look',
        enforce: 'pre',
        transform(code: string, id: string) {
          if (!id.endsWith('games/base-3d/main.ts')) return null
          let out = `import { spikeLook } from '/@fs${SPIKE}'\n${code}`
          // A low-resolution field: the short side is 180 (spec 6), the long side follows 844:390.
          if (MODE !== 'full')
            out = out.replace('size: { width: 844, height: 390 }', 'size: { width: 389, height: 180 }')
          out = out.replace(
            'buildScene(view, occluders, ROOM, ROOM_WORLD)',
            `buildScene(view, occluders, ROOM, ROOM_WORLD); spikeLook(view, ${JSON.stringify(MODE)})`,
          )
          return out
        },
      },
    ],
  }),
)
