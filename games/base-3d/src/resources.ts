// base-3d's resources: the progress a save keeps that the sim itself changes (DESIGN.md §12.1). Sim code.
import { defineResource } from '@mcthaydt/automata-sim'
import { z } from 'zod'

/** Embers taken this game; `screens/saves.ts` captures it into the save and applies it back before tick 0. */
export const Progress = defineResource(
  'progress',
  z.object({ embers: z.number().int().nonnegative() }),
  () => ({
    embers: 0,
  }),
)
