/**
 * Whether the pointer is hidden.
 *
 * Only on a `gameplay` screen, only while not paused, and only when the player
 * is not using the mouse -- or has left it still for two seconds. Never on a
 * menu: a hidden cursor there is a lost player.
 *
 * From FloorFifty `apps/client/src/ui/cursor-policy.ts` at `ac72660`; the
 * screen test reads a `ScreenDef`'s `kind` instead of FloorFifty's screen id.
 */

/** How long the pointer must be still before it hides on a gameplay screen. */
export const CURSOR_IDLE_MS = 2000
/** The device the player used last, as the cursor policy sees it. */
export type CursorInput = 'pointer' | 'keyboard' | 'gamepad' | 'touch'
/** A screen's kind (`ScreenDef.kind`): only `gameplay` may hide the pointer. */
export type ScreenKind = 'menu' | 'gameplay'

/** Whether the pointer is hidden now: on a gameplay screen, not paused, and the pointer unused or idle. */
export function cursorHidden(state: {
  kind: ScreenKind | undefined
  paused: boolean
  lastInput: CursorInput
  msSincePointerMove: number
}): boolean {
  if (state.kind !== 'gameplay' || state.paused) return false
  return state.lastInput !== 'pointer' || state.msSincePointerMove >= CURSOR_IDLE_MS
}

/**
 * Applies `cursorHidden` to a target element: `attach` follows pointer moves and key presses, and each `tick` sets the
 * element's `cursor` style. Detaching shows the pointer again.
 */
export class CursorRunner {
  private lastInput: CursorInput = 'pointer'
  private movedAt: number
  private readonly now: () => number

  constructor(
    private readonly target: HTMLElement,
    private readonly options: {
      now?: () => number
      kind?: () => ScreenKind | undefined
      paused?: () => boolean
    } = {},
  ) {
    this.now = options.now ?? (() => performance.now())
    this.movedAt = this.now()
  }

  noteInput(input: CursorInput): void {
    this.lastInput = input
    if (input === 'pointer') this.movedAt = this.now()
  }

  attach(events: EventTarget = window): () => void {
    const onMove = (): void => this.noteInput('pointer')
    const onKey = (): void => this.noteInput('keyboard')
    events.addEventListener('pointermove', onMove)
    events.addEventListener('keydown', onKey)
    return () => {
      events.removeEventListener('pointermove', onMove)
      events.removeEventListener('keydown', onKey)
      this.target.style.cursor = ''
    }
  }

  tick(): void {
    const hidden = cursorHidden({
      kind: this.options.kind?.() ?? 'gameplay',
      paused: this.options.paused?.() ?? false,
      lastInput: this.lastInput,
      msSincePointerMove: this.now() - this.movedAt,
    })
    const next = hidden ? 'none' : ''
    if (this.target.style.cursor !== next) this.target.style.cursor = next
  }
}
