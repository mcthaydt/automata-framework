// A scripted run from the start to the goal (the ember), as (direction, jump held, ticks) segments. It pins the
// sim's behavior: the golden tests replay it and compare the final state hash, in Node and in Chromium, WebKit
// and Firefox (determinism is cross-engine, AGENTS.md). The browser journeys replay it with real key presses.
// Any change to movement, the room or the plugin changes the hash on purpose: investigate it, never rebaseline
// it per engine.
import type { MoveInput } from '../features/player/move.command.ts'

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
 * The sim's state hash after the whole golden route, with seed 1. Re-recorded when physics (#9) merged: its
 * schema hash also covers resource and command schemas (was `a40a6dbda55f4932`; same route, same goal tick). Re-recorded
 * again when the room and the tunables became compiled content (GAME-2D.ED; was `31f50888ccb4cf0a`; same route, same
 * goal tick, same state on every tick, see `golden-equivalence.test.ts`): the sim's content now carries the room and the
 * tuning, and the content hash is part of the state hash (`world/sim.ts`). Re-recorded once more when the game became
 * Emberwick (was `94285fae634fdba9`): the plugin's name is part of the state hash and it went from `base-2d` to
 * `emberwick`. The route, the goal tick and the state on every tick are the same.
 */
export const GOLDEN_HASH = '421c5a1bf522299e'
