import { AppLoop, PresentationBus, type ScreenDef, Time } from '@mcthaydt/automata-runtime'
import { type Command, createSim } from '@mcthaydt/automata-sim'
import { Effect } from 'effect'
import { mount, unmount } from 'svelte'
import Hud from './Hud.svelte'
import type { StressParams } from './params.ts'
import { Beat } from './sim/stress.event.ts'
import { spawnStress, stressPlugin } from './sim/stress.plugin.ts'

// The stress scene takes no input, so every tick gets the same empty command list (no allocation per tick).
const NO_COMMANDS: readonly Command[] = Object.freeze([])

/**
 * The only screen: builds the N × M sim, mounts the UI over the canvas and hands the sim to the runtime's AppLoop,
 * which steps it, applies each tick's render delta to the entity views and draws every frame. Closing the
 * screen's scope stops the loop and frees the sim.
 */
export function stressScreen(params: StressParams): ScreenDef {
  return {
    id: 'stress',
    enter: (context) =>
      Effect.gen(function* () {
        const appLoop = yield* AppLoop
        const bus = yield* PresentationBus
        const time = yield* Time
        const sim = yield* Effect.promise(() =>
          createSim({ seed: params.seed, plugins: [stressPlugin(params.systems)] }),
        )
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

        yield* Effect.addFinalizer(() =>
          Effect.sync(() => {
            unsubscribe()
            appLoop.stop()
            void unmount(hud)
            target.remove()
            sim.dispose()
          }),
        )
      }),
  }
}
