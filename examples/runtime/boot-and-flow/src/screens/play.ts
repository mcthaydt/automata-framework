import { AppLoop, Flow, PresentationBus, type ScreenDef } from '@mcthaydt/automata-runtime'
import { createSim, type Sim } from '@mcthaydt/automata-sim'
import { Effect } from 'effect'
import { counterPlugin } from '../sim/counter.plugin.ts'

let activeSim: Sim | null = null

export function resetActiveSim(): void {
  activeSim = null
}

export const playScreen: ScreenDef = {
  id: 'play',
  enter: (ctx) =>
    Effect.gen(function* () {
      const flow = yield* Flow
      const appLoop = yield* AppLoop
      const bus = yield* PresentationBus

      if (!activeSim) {
        activeSim = yield* Effect.promise(() => createSim({ seed: 1, plugins: [counterPlugin] }))
      }
      const sim = activeSim

      const div = document.createElement('div')
      div.className = 'af-screen-frame'
      div.setAttribute('data-screen-frame', '')
      div.setAttribute('data-testid', 'play-screen')

      const header = document.createElement('div')
      header.className = 'af-screen-frame__header'
      const h1 = document.createElement('h1')
      h1.textContent = 'Gameplay'
      header.appendChild(h1)

      const body = document.createElement('div')
      body.className = 'af-screen-frame__body'
      const tickLabel = document.createElement('p')
      tickLabel.textContent = 'Tick: '
      const tickSpan = document.createElement('span')
      tickSpan.setAttribute('data-testid', 'tick')
      tickSpan.setAttribute('data-tick', String(sim.tick))
      tickSpan.textContent = String(sim.tick)
      tickLabel.appendChild(tickSpan)
      body.appendChild(tickLabel)

      const actions = document.createElement('div')
      actions.className = 'af-action-bar'
      actions.setAttribute('data-testid', 'actions')
      const pauseBtn = document.createElement('button')
      pauseBtn.className = 'af-control af-control--primary'
      pauseBtn.setAttribute('data-kind', 'primary')
      pauseBtn.setAttribute('data-testid', 'pause-btn')
      pauseBtn.setAttribute('data-action', 'pause')
      pauseBtn.textContent = 'Pause'
      pauseBtn.onclick = () => flow.dispatch('pause')
      actions.appendChild(pauseBtn)

      div.appendChild(header)
      div.appendChild(body)
      div.appendChild(actions)
      ctx.layer.appendChild(div)

      const unsubscribe = bus.subscribe('sim.events', () => {
        tickSpan.textContent = String(sim.tick)
        tickSpan.setAttribute('data-tick', String(sim.tick))
      })

      appLoop.run({ sim, commands: () => [] })

      yield* Effect.addFinalizer(() =>
        Effect.sync(() => {
          unsubscribe()
          appLoop.stop()
          div.remove()
        }),
      )
    }),
}
