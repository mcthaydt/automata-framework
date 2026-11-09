import type { ScreenDef } from '@automataframework/automata'
import { type Command, createSim } from '@automataframework/automata-sim'
import { mount, unmount } from 'svelte'
import Hud from './Hud.svelte'
import type { StressParams } from './params.ts'
import { Beat } from './sim/stress.event.ts'
import { spawnStress, stressPlugin } from './sim/stress.plugin.ts'

// The stress scene takes no input, so every tick gets the same empty command list (no allocation per tick).
const NO_COMMANDS: readonly Command[] = Object.freeze([])

/**
 * The only screen: builds the N × M sim, mounts the UI over the canvas and hands the sim to the runtime's AppLoop,
 * which steps it, applies each tick's render delta to the entity views and draws every frame. Leaving the
 * screen stops the loop and frees the sim.
 */
export function stressScreen(params: StressParams): ScreenDef {
  return {
    id: 'stress',
    enter: async (context) => {
      const { appLoop, bus, time } = context.services
      const sim = await createSim({ seed: params.seed, plugins: [stressPlugin(params.systems)] })
      if (context.screen.disposed) {
        sim.dispose()
        return
      }
      spawnStress(sim, params.entities, params.seed)

      const target = document.createElement('div')
      context.layer.appendChild(target)
      const hud = mount(Hud, {
        target,
        props: {
          entities: params.entities,
          systems: params.systems,
          onPauseChange: (paused: boolean) => (paused ? time.pause('menu') : time.resume('menu')),
        },
      })
      const unsubscribe = bus.subscribe('sim.events', (events) => {
        for (const event of events) {
          if (event.type === Beat.id) hud.showTicks((event.payload as { tick: number }).tick)
        }
      })

      appLoop.run({ sim, commands: () => NO_COMMANDS })

      context.screen.add(() => {
        unsubscribe()
        appLoop.stop()
        void unmount(hud)
        target.remove()
        sim.dispose()
      })
    },
  }
}
