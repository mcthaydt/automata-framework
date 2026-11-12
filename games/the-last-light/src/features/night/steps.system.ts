import { InSector } from '@automata/sectors/sim'
import { defineSystem, type SimContext, type SystemDef } from '@automata/sim'
import { SystemsScene } from '@automata/systems/sim'
import { Ada } from '../../shared/ada.component.ts'
import { Night } from './night.resource.ts'

/** What the systems' `hear` takes: a noise, and where it is. */
export type Hear = (
  ctx: SimContext,
  noise: {
    readonly at: { readonly x: number; readonly z: number }
    readonly loudness: number
    readonly kind: string
  },
) => void

/**
 * Ada's footsteps: while she walks, a small noise every `stepEvery` seconds that carries `stepLoudness` metres, heard by
 * the creature (the old rule R-footsteps, now a system: the file's rule would need a call the file cannot answer). Both
 * numbers are the creature's file's tunables.
 */
export const steps = (hear: Hear): SystemDef =>
  defineSystem({
    name: 'night.steps',
    phase: 'gameplay',
    before: ['systems.step'],
    run: (ctx) => {
      const def = ctx.resource(SystemsScene).def
      if (def === null) return
      const every = def.tunables.stepEvery?.value ?? 0.45
      const loudness = def.tunables.stepLoudness?.value ?? 1.8
      const night = ctx.resource(Night)
      for (const ada of ctx.query(Ada, InSector)) {
        if (!ada.get(Ada).walking) continue
        night.step -= ctx.dt
        if (night.step > 0) continue
        night.step = every
        hear(ctx, { at: ada.get(InSector), loudness, kind: 'step' })
      }
    },
  })
