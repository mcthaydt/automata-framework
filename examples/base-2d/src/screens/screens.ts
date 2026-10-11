import type { Screen } from '../flow.ts'

// The base's screens as plain DOM over the canvas. Stand-in for the `ui` primitives (M1.6, PR #7): 44 px
// controls, 48 px primary actions, Endesga 64 colors, focus moved to each screen's primary action. Layout
// follows the container (style.css), not the viewport.

export interface ScreenHandlers {
  readonly onContinue: () => void
  readonly onPlay: () => void
  readonly onPause: () => void
  readonly onResume: () => void
  readonly onQuit: () => void
}

export interface Screens {
  /** The element the renderer puts its canvas in. */
  readonly stage: HTMLElement
  readonly touchButtons: readonly HTMLElement[]
  show(screen: Screen, details?: { seconds?: number }): void
}

export function createScreens(root: HTMLElement, handlers: ScreenHandlers): Screens {
  root.innerHTML = `
    <div class="stage-box"></div>
    <section class="panel" data-for="splash" aria-label="Splash">
      <p class="mark">AutomataFramework</p>
      <p class="hint blink">Press any key or tap</p>
    </section>
    <section class="panel" data-for="menu" aria-labelledby="menu-title">
      <h1 id="menu-title" class="title">Emberwick</h1>
      <p class="hint">Carry your lantern up to the ember.</p>
      <div class="actions"><button type="button" class="primary" data-action="play">Play</button></div>
      <p class="keys"><kbd>←</kbd><kbd>→</kbd> move <kbd>Space</kbd> jump <kbd>Esc</kbd> pause</p>
    </section>
    <section class="panel" data-for="paused" aria-labelledby="paused-title">
      <h2 id="paused-title">Paused</h2>
      <div class="actions">
        <button type="button" class="primary" data-action="resume">Resume</button>
        <button type="button" data-action="quit">Quit</button>
      </div>
    </section>
    <section class="panel" data-for="end" aria-labelledby="end-title">
      <h2 id="end-title">The ember is yours</h2>
      <p class="time" data-slot="time"></p>
      <div class="actions">
        <button type="button" class="primary" data-action="play">Play again</button>
        <button type="button" data-action="quit">Menu</button>
      </div>
    </section>
    <div class="hud" data-for="room">
      <button type="button" class="pause" data-action="pause" aria-label="Pause">II</button>
    </div>
    <div class="touch" data-for="room" aria-hidden="true">
      <button type="button" tabindex="-1" data-hold="left">◀</button>
      <button type="button" tabindex="-1" data-hold="right">▶</button>
      <button type="button" tabindex="-1" data-hold="jump" class="jump">▲</button>
    </div>`

  const actions: Record<string, () => void> = {
    play: handlers.onPlay,
    pause: handlers.onPause,
    resume: handlers.onResume,
    quit: handlers.onQuit,
  }
  root.addEventListener('click', (event) => {
    const button = (event.target as HTMLElement).closest<HTMLElement>('[data-action]')
    const action = button?.dataset.action
    if (action !== undefined) actions[action]?.()
  })
  root.querySelector('[data-for="splash"]')?.addEventListener('click', handlers.onContinue)

  const stage = root.querySelector<HTMLElement>('.stage-box')
  if (stage === null) throw new Error('screens: no stage')
  const time = root.querySelector<HTMLElement>('[data-slot="time"]')

  return {
    stage,
    touchButtons: [...root.querySelectorAll<HTMLElement>('[data-hold]')],
    show(screen, details) {
      root.dataset.screen = screen
      for (const element of root.querySelectorAll<HTMLElement>('[data-for]'))
        element.hidden = element.dataset.for !== screen
      if (screen === 'end' && time !== null && details?.seconds !== undefined)
        time.textContent = `${details.seconds.toFixed(2)} s`
      root.querySelector<HTMLElement>(`[data-for="${screen}"] .primary`)?.focus()
    },
  }
}
