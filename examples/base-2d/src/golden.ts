// A scripted run from the start to the goal (the ember), as (direction, jump held, ticks) segments. It pins the
// sim's behavior: the golden tests replay it and compare the final state hash, in Node and in Chromium, WebKit
// and Firefox (determinism is cross-engine, AGENTS.md). The browser journeys replay it with real key presses.
// Any change to movement, the room or the plugin changes the hash on purpose: investigate it, never rebaseline
// it per engine.
import type { MoveInput } from './sim/index.ts'

export type RouteSegment = readonly [x: MoveInput['x'], jump: boolean, ticks: number]

export const GOLDEN_ROUTE: readonly RouteSegment[] = [
  [1, false, 30], // walk right, out from under the first platform
  [-1, true, 14], // jump back left onto it
  [-1, false, 20],
  [1, false, 12],
  [1, true, 16], // up and right to the second
  [1, false, 12],
  [0, false, 10],
  [1, false, 25],
  [1, true, 16], // the third
  [1, false, 12],
  [0, false, 10],
  [1, false, 30],
  [1, true, 16], // the fourth, by the right wall
  [1, false, 8],
  [0, false, 10],
  [-1, false, 4],
  [-1, true, 18], // back left to the fifth
  [-1, false, 10],
  [0, false, 10],
  [-1, false, 24],
  [-1, true, 18], // the top platform
  [-1, false, 30], // and into the ember
]

/** The route as one input per tick. */
export function routeInputs(route: readonly RouteSegment[] = GOLDEN_ROUTE): MoveInput[] {
  return route.flatMap(([x, jump, ticks]) => Array.from({ length: ticks }, () => ({ x, jump })))
}

/** The tick the golden route touches the goal on. */
export const GOLDEN_GOAL_TICK = 342
/**
 * The sim's state hash after the whole golden route, with seed 1. Re-recorded when the room moved into
 * compiled content (`content/rooms/room-1.toml`): the sim's content went from `{ room }` to the compiled sim
 * partition `{ tuning, rooms }` (M2.2's `simContent` shape), so its content hash, part of the state hash,
 * changed. The route, the goal tick and every movement test are the same. Was `31f50888ccb4cf0a`, itself
 * re-recorded when physics #9 merged, from `a40a6dbda55f4932`.
 */
export const GOLDEN_HASH = 'd8a0f00cf8cae7e8'
