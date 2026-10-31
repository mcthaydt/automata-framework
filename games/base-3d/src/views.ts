// base-3d's views (DESIGN.md §3.1): render rows to what the renderer draws. Here, Wick's render rows to the figure
// view's state (M3 spec §4.4.5): sim units to metres, radians and seconds. Not sim code: `pnpm boundaries` does not
// scan it, and the sim never reads it back (law 1).

import type { FigureViewState } from '@mcthaydt/automata-render-pixi3d'
import { Q16 } from '@mcthaydt/automata-render-pixi3d/sim'
import type { FieldRecord } from '@mcthaydt/automata-sim'
import { ACTION_CLIP, TICK_HZ, WALK_SPEED } from './constants.ts'

type Components = Readonly<Record<string, Readonly<FieldRecord>>>

/** The item Wick holds in the first slice: the sword (the shield waits on a second hand's item, M3.7b plan). */
export const HERO_ITEM = 'sword'
/** Where the lock aims on a target standing at the floor: its head and its chest, in metres above it. */
const AIM_HEIGHTS = { head: 1.5, chest: 1.2 } as const

/** Turn units (65,536 a turn) to radians, 2π spelled out (`pnpm boundaries` scans src/ until GL.7 lands). */
const radians = (units: number): number => (units * 6.283185307179586) / 65_536
const seconds = (tick: number): number => tick / TICK_HZ
/** Each action code's clip id: `ACTION_CLIP` the other way round. */
const CLIP_IDS: Readonly<Record<number, string>> = {
  [ACTION_CLIP.slash]: 'slash',
  [ACTION_CLIP.point]: 'point',
  [ACTION_CLIP.pickup]: 'pickup',
}

/**
 * Wick's figure state from his `hero` and `hero-action` rows. `target` is the locked target's `target` row (its
 * plan position in Q16.16 metres), which the page looks up by `hero.lockTarget`; the head and chest aim at it while
 * he is locked.
 */
export function heroFigureState(
  components: Components,
  target?: { readonly x: number; readonly z: number },
): FigureViewState {
  const hero = components.hero ?? {}
  const act = components['hero-action'] ?? {}
  const moving = hero.moving === true
  const clip = CLIP_IDS[Number(act.clip ?? 0)]
  const locked = Number(hero.lockTarget ?? 0) !== 0 && target !== undefined
  return {
    moving,
    speed: moving ? WALK_SPEED : 0,
    moveDir: radians(Number(hero.moveDir ?? 0)),
    item: HERO_ITEM,
    ...(clip !== undefined && { action: { id: clip, startedAt: seconds(Number(act.startedAt)) } }),
    ...(act.guard === true && { stances: [{ id: 'guard', startedAt: seconds(Number(act.guardSince)) }] }),
    ...(locked && {
      aim: (['head', 'chest'] as const).map((part) => ({
        part,
        at: [target.x / Q16, AIM_HEIGHTS[part], target.z / Q16] as const,
      })),
    }),
  }
}
