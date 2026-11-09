// textures-atlas: sprites drawn from one packed picture
//
// Shows: sprite(url, { frame }) draws one named frame of a texture atlas that `automata-content assets` packed
//   from a folder of PNG frames; each frame keeps its own name, so art can be repacked without touching code.
// Controls: none
// Packages: @mcthaydt/automata
// Difficulty: ★★☆☆
// Tier: core
// Golden: 120
import { defineComponent, defineGame, definePlugin, defineSystem, sprite } from '@mcthaydt/automata'

// Wick's two run frames, packed by content/atlases.toml into an atlas page served beside this page
// (public/textures/atlas/; the frames' provenance is resources/atlas-frames/PROVENANCE.md).
const atlas = 'wick-0.json'

// One component per frame, so each view shows its own named frame.
const StrideA = defineComponent('stride-a', { x: 'f32', y: 'f32' })
const StrideB = defineComponent('stride-b', { x: 'f32', y: 'f32' })

// Both Wicks run right one pixel a tick and wrap at the edge.
const run = defineSystem('run', (ctx) => {
  for (const kind of [StrideA, StrideB]) {
    for (const runner of ctx.query(kind)) {
      const { x } = runner.get(kind)
      runner.set(kind, { x: x > 328 ? -8 : x + 1 })
    }
  }
})

const runners = definePlugin({ name: 'runners', defs: [StrideA, StrideB, run] })

export default defineGame({
  id: 'textures-atlas',
  size: { width: 320, height: 180 },
  sim: {
    plugins: [runners],
    seed: 1,
    setup: (sim) => {
      sim.spawn([[StrideA, { x: 120, y: 90 }]])
      sim.spawn([[StrideB, { x: 200, y: 90 }]])
    },
  },
  views: {
    [StrideA.id]: sprite(atlas, { frame: 'run-a' }),
    [StrideB.id]: sprite(atlas, { frame: 'run-b' }),
  },
})
