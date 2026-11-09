// The look's passes, in the order they run: the DUEL snap, then the outline when it is switched on, then the passes
// extensions added with `addLookPass`, then the finish, always last. An extension's pass has its own switch (or one of the
// look's `switches`) and keeps the frame's alpha, which the finish reads.

import type { Pass3D } from '@pixi/3d'
import { RegistryClash } from '../../shared/registry/registry-clash.ts'
import type { TimeOfDay } from '../../shared/time-of-day/time-of-day.ts'
import { DuelSnapEffect } from './duel-snap-filter.ts'
import { FinishEffect } from './finish-effect.ts'
import type { Look } from './look.schema.ts'
import { MOODS, moodRemap } from './moods.ts'
import { OutlineEffect } from './outline-filter.ts'

/** A pass an extension adds after core's: `make` builds it for a look and a time of day. */
export interface LookPass {
  readonly name: string
  make(look: Look, time: TimeOfDay): Pass3D
}

export interface LookPasses {
  /** Every pass, in order: assign it to `view.passes`. */
  readonly list: readonly Pass3D[]
  readonly snap: DuelSnapEffect
  readonly outline: OutlineEffect | undefined
  /** The extensions' passes, in registration order. */
  readonly extra: readonly Pass3D[]
  /** The last pass: it turns the frame's codes into what the stage blends and applies the mood. */
  readonly finish: FinishEffect
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
  const snap = new DuelSnapEffect(look.switches.dither ? look.dither.strength : 0)
  const outline = look.switches.outline ? new OutlineEffect(look.outline.edge) : undefined
  const extra = REGISTERED.map((pass) => pass.make(look, time))
  const mood = look.mood === undefined || !look.switches.grade ? undefined : MOODS[look.mood]
  if (look.mood !== undefined && MOODS[look.mood] === undefined)
    throw new Error(
      `The look names the mood "${look.mood}", which there is not. The moods are: ${Object.keys(MOODS).join(', ')}.`,
    )
  const finish = new FinishEffect(mood === undefined ? undefined : moodRemap(mood))
  return { list: [snap, ...(outline ? [outline] : []), ...extra, finish], snap, outline, extra, finish }
}
