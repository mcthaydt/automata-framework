// A complete headless simulation example. Verified against the adjacent framework by tests/api-contract.test.ts.
export const STARTER_CODE = `import { createSim, defineComponent, definePlugin, defineSystem } from '@mcthaydt/automata-sim'

const Position = defineComponent('position', { x: 'f64' })
const movement = defineSystem({
  name: 'movement',
  phase: 'gameplay',
  run(ctx) {
    for (const entity of ctx.query(Position)) {
      entity.set(Position, { x: entity.get(Position).x + ctx.dt })
    }
  },
})
const sim = await createSim({
  seed: 42,
  plugins: [definePlugin({
    name: 'motion',
    components: [Position],
    systems: [movement],
  })],
})
const player = sim.spawn([[Position, { x: 0 }]])
sim.step([])
console.log(sim.entity(player)?.get(Position).x) // 1 / 60
sim.dispose()`
