/**
 * Whether the player has asked for less movement.
 *
 * Checked at call time rather than cached, because the setting can change
 * while the game is open. Primitives also honour it in CSS; this is for code
 * that moves things itself.
 */
export function reducedMotion(win: Pick<Window, 'matchMedia'> = globalThis): boolean {
  return win.matchMedia?.('(prefers-reduced-motion: reduce)').matches === true
}
