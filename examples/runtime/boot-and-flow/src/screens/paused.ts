import { Flow, type ScreenDef } from '@mcthaydt/automata-runtime'
import { Effect } from 'effect'

export const pausedScreen: ScreenDef = {
  id: 'paused',
  pausesSim: true,
  enter: (ctx) =>
    Effect.gen(function* () {
      const flow = yield* Flow

      const div = document.createElement('div')
      div.className = 'af-screen-frame'
      div.setAttribute('data-screen-frame', '')
      div.setAttribute('data-testid', 'paused-screen')

      const header = document.createElement('div')
      header.className = 'af-screen-frame__header'
      const h1 = document.createElement('h1')
      h1.textContent = 'Paused'
      header.appendChild(h1)

      const body = document.createElement('div')
      body.className = 'af-screen-frame__body'
      const p = document.createElement('p')
      p.textContent = 'Simulation is paused.'
      body.appendChild(p)

      const actions = document.createElement('div')
      actions.className = 'af-action-bar'
      actions.setAttribute('data-testid', 'actions')
      const resumeBtn = document.createElement('button')
      resumeBtn.className = 'af-control af-control--primary'
      resumeBtn.setAttribute('data-kind', 'primary')
      resumeBtn.setAttribute('data-testid', 'resume-btn')
      resumeBtn.setAttribute('data-action', 'resume')
      resumeBtn.textContent = 'Resume'
      resumeBtn.onclick = () => flow.dispatch('resume')
      actions.appendChild(resumeBtn)

      div.appendChild(header)
      div.appendChild(body)
      div.appendChild(actions)
      ctx.layer.appendChild(div)

      yield* Effect.addFinalizer(() => Effect.sync(() => div.remove()))
    }),
}
