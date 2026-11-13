// The look's passes, in the order they run: the haze when it is on, the mood grade (off until a mood is set), the passes
// extensions added with `addLookPass` and `beforeSnap` (a colour grade of their own: its colours are then snapped to the
// palette), the DUEL snap, the outline when it is switched on, then the other passes extensions added with `addLookPass`
// (stars, rain and bloom are the world kit's). An extension's pass has its own switch, so the look's `switches` name only
// core's. The last pass draws to the canvas and must not sample the depth, and a pass before it that did leaves its binding
// behind (`present-pass.ts`): the snap samples none, and a `PresentEffect` ends the list whenever any pass but the snap is in it.

import type { Pass3D } from '@pixi/3d'
import { RegistryClash } from '../../shared/registry/registry-clash.ts'
import type { TimeOfDay } from '../../shared/time-of-day/time-of-day.ts'
import { DuelSnapEffect } from './duel-snap-filter.ts'
import { GradeEffect } from './grade-effect.ts'
import { HazeEffect, hazeOf } from './haze.ts'
import type { Look } from './look.schema.ts'
import { OutlineEffect } from './outline-filter.ts'
import { PresentEffect } from './present-pass.ts'

/** A pass an extension adds after core's: `make` builds it for a look and a time of day. */
export interface LookPass {
  readonly name: string
  /**
   * Run before the DUEL snap instead of after it, so what the pass does to a colour is snapped to the palette (a colour
   * grade). Default: after, for a pass that draws palette colours itself or simulates the display.
   */
  readonly beforeSnap?: boolean | undefined
  make(look: Look, time: TimeOfDay): Pass3D
}

export interface LookPasses {
  /** Every pass, in order: assign it to `view.passes`. */
  readonly list: readonly Pass3D[]
  readonly snap: DuelSnapEffect
  /** The distance haze, before the snap; absent when the look's `haze` switch is off. */
  readonly haze: HazeEffect | undefined
  /** The mood grade, before the snap so the frame lands back on the palette; off until `grade.mood` is given one. Absent when the look's `grade` switch is off. */
  readonly grade: GradeEffect | undefined
  readonly outline: OutlineEffect | undefined
  /** The extensions' passes that run before the snap (`beforeSnap`), after the haze and the grade, in registration order. */
  readonly early: readonly Pass3D[]
  /** The pass that ends the list when any pass but the snap is in it (the haze, the grade, an early pass, the outline or a later one); absent when the snap alone runs. */
  readonly present: PresentEffect | undefined
  /** The extensions' passes that run after the snap and the outline, in registration order. */
  readonly extra: readonly Pass3D[]
}

const REGISTERED: LookPass[] = []

/** Registers a pass that runs after core's. Throws `RegistryClash` on a name already taken. */
export function addLookPass(pass: LookPass): void {
  if (REGISTERED.some((p) => p.name === pass.name)) throw new RegistryClash('look pass', pass.name)
  REGISTERED.push(pass)
}

/** The registered passes, in registration order. */
export const registeredLookPasses = (): readonly LookPass[] => REGISTERED

/** The passes for `look` at `time`. The snap always runs: a frame is DUEL or it is not the look. */
export function createLookPasses(look: Look, time: TimeOfDay): LookPasses {
  const snap = new DuelSnapEffect(look.switches.dither ? look.dither.strength : 0, look.dither)
  const outline = look.switches.outline ? new OutlineEffect(look.outline) : undefined
  const early = REGISTERED.filter((pass) => pass.beforeSnap === true).map((pass) => pass.make(look, time))
  const extra = REGISTERED.filter((pass) => pass.beforeSnap !== true).map((pass) => pass.make(look, time))
  const haze = look.switches.haze ? new HazeEffect(hazeOf(look.haze, time.scene.haze)) : undefined
  const grade = look.switches.grade ? new GradeEffect() : undefined
  const after = [...(outline ? [outline] : []), ...extra]
  // Any pass but the snap may sample the scene depth, the ones before it as much as the ones after (the grade is off until a
  // mood is set, but it can be set once the list is made; an early pass is one of the extensions' passes): only the snap alone needs no present pass.
  const present =
    haze !== undefined || grade !== undefined || early.length > 0 || after.length > 0
      ? new PresentEffect()
      : undefined
  return {
    list: [
      ...(haze ? [haze] : []),
      ...(grade ? [grade] : []),
      ...early,
      snap,
      ...after,
      ...(present ? [present] : []),
    ],
    snap,
    haze,
    grade,
    outline,
    early,
    present,
    extra,
  }
}
