// The look's passes, in the order they run: the passes extensions added with `addLookPass` and `beforeSnap` (a colour
// grade: its colours are then snapped to the palette), the DUEL snap, the outline when it is switched on, then the other
// passes extensions added with `addLookPass` (stars, rain and bloom are the world kit's). An extension's pass has its own
// switch, so the look's `switches` name only core's.

import type { Pass3D } from '@pixi/3d'
import { RegistryClash } from '../../shared/registry/registry-clash.ts'
import type { TimeOfDay } from '../../shared/time-of-day/time-of-day.ts'
import { DuelSnapEffect } from './duel-snap-filter.ts'
import type { Look } from './look.schema.ts'
import { OutlineEffect } from './outline-filter.ts'

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
  readonly outline: OutlineEffect | undefined
  /** The extensions' passes that run before the snap (`beforeSnap`), in registration order. */
  readonly early: readonly Pass3D[]
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
  const snap = new DuelSnapEffect(look.switches.dither ? look.dither.strength : 0)
  const outline = look.switches.outline ? new OutlineEffect(look.outline.edge) : undefined
  const early = REGISTERED.filter((pass) => pass.beforeSnap === true).map((pass) => pass.make(look, time))
  const extra = REGISTERED.filter((pass) => pass.beforeSnap !== true).map((pass) => pass.make(look, time))
  return { list: [...early, snap, ...(outline ? [outline] : []), ...extra], snap, outline, early, extra }
}
