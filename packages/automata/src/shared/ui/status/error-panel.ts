/** One way forward from a failure. */
export interface ErrorAction {
  readonly id: string
  readonly label: string
  readonly kind: 'primary' | 'secondary'
  readonly onSelect: () => void
}

/**
 * Every failure shown names a way forward. A panel with none is a bug, not a state, unless the
 * failure is final (the device cannot run the game at all). Thrown so a test or a dev build fails
 * loudly instead of drawing a dead end.
 */
export function assertWayForward(actions: readonly ErrorAction[], final: boolean): void {
  if (actions.length === 0 && !final) {
    throw new Error('ErrorPanel needs at least one way forward (an action), or `final` when there is none')
  }
}
