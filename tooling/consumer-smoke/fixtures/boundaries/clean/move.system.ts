// A clean sim file for the automata-check-boundaries step: deterministic math only.
export function step(x: number, dt: number): number {
  return Math.floor(x + dt)
}
