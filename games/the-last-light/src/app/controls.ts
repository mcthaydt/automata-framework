import { CutsceneSkip } from '@automata/cutscenes/sim'
import { ToggleLight } from '@automata/systems/sim'
import type { Send } from './live.ts'

// The controls that are not held keys. The input map sends what is held, every tick, which suits walking and turning the camera
// and would flick the lamp every tick it was held: so the lamp is a press, and skipping a cutscene is a key or the pad's start
// held for a moment (and a Skip button on the screen), so a stray press never throws a scene away. Each sends one command; the sim decides what it does.

/** How long skipping is held, in milliseconds. */
export const HOLD_TO_SKIP = 800

/** The standard gamepad's north button (Y, triangle) and start. */
const PAD_LAMP = 3
const PAD_START = 9
/** The key that skips a cutscene when held. Space and Enter press the button that has the focus, and Escape pauses. */
const SKIP_KEYS: ReadonlySet<string> = new Set(['KeyX'])

export interface ControlsOptions {
  readonly target: Pick<Window, 'addEventListener' | 'removeEventListener'>
  readonly send: Send
  /** Whether a cutscene holds the input now. */
  readonly inCutscene: () => boolean
  /** The pad's buttons now, or undefined with no pad. */
  readonly pad: () => { readonly buttons: readonly boolean[] } | undefined
  /** Runs `tick` again a frame later; the page's animation frame. */
  readonly poll?: ((tick: () => void) => void) | undefined
}

/** Starts the controls; returns what stops them. */
export function attachControls(options: ControlsOptions): () => void {
  const { target, send } = options
  let skipTimer: ReturnType<typeof setTimeout> | undefined
  let stopped = false

  const cancelSkip = (): void => {
    if (skipTimer !== undefined) clearTimeout(skipTimer)
    skipTimer = undefined
  }
  const holdToSkip = (): void => {
    if (skipTimer !== undefined || !options.inCutscene()) return
    skipTimer = setTimeout(() => {
      skipTimer = undefined
      if (options.inCutscene()) send({ type: CutsceneSkip.id, payload: {} })
    }, HOLD_TO_SKIP)
  }

  const down = (event: Event): void => {
    const { code, repeat } = event as KeyboardEvent
    if (repeat) return
    if (code === 'KeyF') send({ type: ToggleLight.id, payload: {} })
    else if (SKIP_KEYS.has(code)) holdToSkip()
  }
  const up = (event: Event): void => {
    if (SKIP_KEYS.has((event as KeyboardEvent).code)) cancelSkip()
  }
  target.addEventListener('keydown', down)
  target.addEventListener('keyup', up)

  // The pad is polled: a press is the frame its button goes down.
  let lampWasDown = false
  let startWasDown = false
  const poll =
    options.poll ??
    ((tick: () => void) => {
      requestAnimationFrame(tick)
    })
  const watch = (): void => {
    if (stopped) return
    const buttons = options.pad()?.buttons ?? []
    const lamp = buttons[PAD_LAMP] === true
    if (lamp && !lampWasDown) send({ type: ToggleLight.id, payload: {} })
    lampWasDown = lamp
    const start = buttons[PAD_START] === true
    if (start && !startWasDown) holdToSkip()
    else if (!start && startWasDown) cancelSkip()
    startWasDown = start
    poll(watch)
  }
  watch()

  return () => {
    stopped = true
    cancelSkip()
    target.removeEventListener('keydown', down)
    target.removeEventListener('keyup', up)
  }
}

/** The first connected gamepad's buttons, as a bare list of pressed. */
export function firstPad(): { readonly buttons: readonly boolean[] } | undefined {
  const pad =
    typeof navigator.getGamepads === 'function'
      ? [...navigator.getGamepads()].find((each) => each !== null)
      : undefined
  return pad === undefined || pad === null
    ? undefined
    : { buttons: pad.buttons.map((button) => button.pressed) }
}
