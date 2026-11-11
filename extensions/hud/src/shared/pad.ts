// A pad steering a piece: the D-pad moves the focus to the nearest control in that direction, A presses the focused one and
// B goes back. The framework's default play screen steers only its own menus with a pad, so a HUD piece asks the pad
// itself, as the dialogue box does. A button already held when the piece appears is not a press.
export interface PadSteerOptions {
  /** B: the piece's way back (close a sheet, dismiss a keypad). */
  readonly onback?: (() => void) | undefined
}

const A = 0
const B = 1
const DPAD = { 12: [0, -1], 13: [0, 1], 14: [-1, 0], 15: [1, 0] } as const

const held = (): ReadonlySet<number> => {
  const down = new Set<number>()
  for (const pad of navigator.getGamepads?.() ?? [])
    pad?.buttons.forEach((button, index) => {
      if (button?.pressed === true) down.add(index)
    })
  return down
}

const centre = (element: Element): { x: number; y: number } => {
  const rect = element.getBoundingClientRect()
  return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 }
}

/** The control to move the focus to from `from`, one step along (dx, dy), or undefined when there is none that way. */
export function neighbour<E extends Element>(
  from: Element,
  controls: readonly E[],
  dx: number,
  dy: number,
): E | undefined {
  const origin = centre(from)
  let best: E | undefined
  let score = Number.POSITIVE_INFINITY
  for (const control of controls) {
    if (control === from) continue
    const at = centre(control)
    const along = (at.x - origin.x) * dx + (at.y - origin.y) * dy
    const across = Math.abs((at.x - origin.x) * dy) + Math.abs((at.y - origin.y) * dx)
    // Only controls that lie ahead, and those straight ahead before those off to the side.
    if (along <= 0.5) continue
    const cost = along + across * 2
    if (cost < score) {
      score = cost
      best = control
    }
  }
  return best
}

/** A Svelte action: `use:padSteer={{ onback }}` on the element holding a piece's controls. */
export function padSteer(
  node: HTMLElement,
  initial: PadSteerOptions = {},
): { update(next: PadSteerOptions): void; destroy(): void } {
  let options = initial
  let before = held()
  let frame = 0
  const poll = (): void => {
    const now = held()
    const pressed = (index: number): boolean => now.has(index) && !before.has(index)
    const focused = document.activeElement
    if (pressed(A) && focused instanceof HTMLElement && node.contains(focused)) focused.click()
    if (pressed(B)) options.onback?.()
    for (const [index, [dx, dy]] of Object.entries(DPAD)) {
      if (!pressed(Number(index))) continue
      const controls = [...node.querySelectorAll<HTMLElement>('button:not(:disabled)')]
      const next =
        focused instanceof HTMLElement && node.contains(focused)
          ? neighbour(focused, controls, dx, dy)
          : controls[0]
      next?.focus({ preventScroll: true })
    }
    before = now
    frame = requestAnimationFrame(poll)
  }
  frame = requestAnimationFrame(poll)
  return {
    update(next) {
      options = next
    },
    destroy() {
      cancelAnimationFrame(frame)
    },
  }
}
