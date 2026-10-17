import { createRng, definePlugin, type PluginDef, type Sim } from '@mcthaydt/automata-sim'
import { Body, Pulse, WORLD } from './stress.component.ts'
import { Beat } from './stress.event.ts'
import { stressMove, stressWorker } from './stress.system.ts'

/** Fastest speed on each axis, in subpixels per tick (2 px at 60 Hz). */
const MAX_SPEED = 2 * WORLD.sub

/** The stress sim with `systems` systems: the mover plus `systems - 1` workers. */
export function stressPlugin(systems: number): PluginDef {
  if (!Number.isInteger(systems) || systems < 1) throw new Error('the stress sim needs at least one system')
  const workers = Array.from({ length: systems - 1 }, (_, index) => stressWorker(index + 1))
  return definePlugin({
    name: 'stress',
    components: [Body, Pulse],
    events: [Beat],
    systems: [stressMove, ...workers],
  })
}

/** Scene setup: `entities` bodies at seeded positions and speeds (never zero on an axis). */
export function spawnStress(sim: Sim, entities: number, seed: number): void {
  const rng = createRng(seed)
  const speed = (): number => (rng.int(MAX_SPEED) + 1) * (rng.int(2) === 0 ? -1 : 1)
  for (let index = 0; index < entities; index += 1) {
    sim.spawn([
      [
        Body,
        {
          x: rng.int(WORLD.width * WORLD.sub),
          y: rng.int(WORLD.height * WORLD.sub),
          vx: speed(),
          vy: speed(),
        },
      ],
      [Pulse, { phase: 0 }],
    ])
  }
}
