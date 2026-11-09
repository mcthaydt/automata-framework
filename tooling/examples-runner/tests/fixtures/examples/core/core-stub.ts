// core-stub: the runner's stand-in example, until DX.2 lets real ones run
//
// Shows: what the runner, the smoke test and the parity test read from an example: an id, a size and a sim
//   (plugins, seed, setup). A plain object, since DX.2's defineGame does not exist yet.
// Controls: none
// Packages: @automataframework/automata-sim
// Difficulty: ★☆☆☆
// Tier: core
// Golden: 60
import {
  createRng,
  defineComponent,
  definePlugin,
  defineSystem,
  type Sim,
} from '@automataframework/automata-sim'

const Spinner = defineComponent('stub.spinner', { angle: 'i32', speed: 'i32' })

const spin = defineSystem({
  name: 'stub.spin',
  phase: 'gameplay',
  run(ctx) {
    for (const spinner of ctx.query(Spinner)) {
      const { angle, speed } = spinner.get(Spinner)
      spinner.set(Spinner, { angle: (angle + speed) % 360 })
    }
  },
})

const stub = definePlugin({ name: 'stub', components: [Spinner], systems: [spin] })

export default {
  id: 'core-stub',
  size: { width: 320, height: 180 },
  sim: {
    plugins: [stub],
    seed: 1,
    setup(sim: Sim) {
      const rng = createRng(1)
      for (let index = 0; index < 3; index++) sim.spawn([[Spinner, { angle: 0, speed: 1 + rng.int(9) }]])
    },
  },
}
