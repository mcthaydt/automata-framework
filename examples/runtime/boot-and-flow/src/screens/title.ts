import { Flow, type ScreenDef } from '@mcthaydt/automata-runtime'
import { Effect } from 'effect'
import { resetActiveSim } from './play.ts'

export const titleScreen: ScreenDef = {
  id: 'title',
  enter: (ctx) =>
    Effect.gen(function* () {
      resetActiveSim()
      const flow = yield* Flow
      const div = document.createElement('div')
      div.className = 'af-screen-frame'
      div.setAttribute('data-screen-frame', '')
      div.setAttribute('data-testid', 'title-screen')

      const header = document.createElement('div')
      header.className = 'af-screen-frame__header'
      const h1 = document.createElement('h1')
      h1.textContent = 'Boot & Flow Demo'
      header.appendChild(h1)

      const body = document.createElement('div')
      body.className = 'af-screen-frame__body'
      const p = document.createElement('p')
      p.textContent = 'A blank game demonstrating the runtime boot sequence and flow transitions.'
      body.appendChild(p)

      const actions = document.createElement('div')
      actions.className = 'af-action-bar'
      actions.setAttribute('data-testid', 'actions')
      const playBtn = document.createElement('button')
      playBtn.className = 'af-control af-control--primary'
      playBtn.setAttribute('data-kind', 'primary')
      playBtn.setAttribute('data-testid', 'play-btn')
      playBtn.setAttribute('data-action', 'play')
      playBtn.textContent = 'Play'
      playBtn.onclick = () => flow.dispatch('play')
      actions.appendChild(playBtn)

      div.appendChild(header)
      div.appendChild(body)
      div.appendChild(actions)
      ctx.layer.appendChild(div)

      yield* Effect.addFinalizer(() => Effect.sync(() => div.remove()))
    }),
}
