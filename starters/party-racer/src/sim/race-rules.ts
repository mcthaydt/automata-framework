import type { RaceTuning } from './tuning.schema'

// The race's rules on plain values, ported from FloorFifty 677d456 (`simulation/collision.ts`, `players.ts`,
// `platforms.ts`, `input.ts`). The systems read and write components; these decide.

/**
 * Collision groups, Rapier's packed `membership << 16 | filter`: a floor is in group 1 and meets racers, a racer is in
 * group 2 and meets floors. Racers never collide with each other, and the groups rather than a rule make that a fact
 * about the world (FloorFifty's category masks).
 */
const FLOOR = 0x0001
const RACER = 0x0002
export const FLOOR_GROUPS: number = (FLOOR << 16) | RACER
export const RACER_GROUPS: number = (RACER << 16) | FLOOR

/** Where every ascent starts: standing on the start floor, at its centre. */
export function spawnPoint(tuning: RaceTuning): { x: number; y: number } {
  return { x: 0, y: tuning.floorHeight / 2 + tuning.racerHeight / 2 }
}

/** The visited string of a fresh ascent: the start floor credited, every other floor not. */
export function freshVisited(floorCount: number): string {
  return `1${'0'.repeat(floorCount - 1)}`
}

/** `visited` with floor `index` credited; the same string when it already was. */
export function credit(visited: string, index: number): string {
  if (visited[index] !== '0') return visited
  return `${visited.slice(0, index)}1${visited.slice(index + 1)}`
}

/** Every floor of the ascent is credited: the ascent is complete. */
export function ascentComplete(visited: string): boolean {
  return !visited.includes('0')
}

/** Wraps `value` into [-half, half]: leaving one side enters the other. */
export function wrapSymmetric(value: number, half: number): number {
  const width = half * 2
  let wrapped = value
  while (wrapped > half) wrapped -= width
  while (wrapped < -half) wrapped += width
  return wrapped
}

/**
 * Advances a moving floor by one tick and turns it at the bounds. Clamping before turning stops a floor creeping one
 * tick's travel past the bound and drifting further out on each turn (FloorFifty's `advancePlatforms`).
 */
export function advanceFloor(
  floor: { readonly x: number; readonly speed: number; readonly direction: number },
  bounds: { readonly left: number; readonly right: number },
  dt: number,
): { x: number; direction: number } {
  const moved = floor.x + floor.speed * floor.direction * dt
  let direction = floor.direction
  if (moved >= bounds.right) direction = -1
  else if (moved <= bounds.left) direction = 1
  return { x: Math.min(Math.max(moved, bounds.left), bounds.right), direction }
}

/** A lapping racer still resting at the spawn this tick. */
export function isHeld(racer: { readonly holdUntil: number }, tick: number): boolean {
  return racer.holdUntil >= 0 && tick < racer.holdUntil
}
