// Registers every prop generator the kit adds, under the `kind` a library preset names. Core's registry refuses a name
// core or an earlier extension took, so a clash is told, never replaced quietly. The kit leaves out the five core
// already has (table, bin, lamp, streetLamp, tree): the base scenes are made of them.
import { registerPropGenerator } from '@automata/3d/props-kit'
import { CLINIC } from './clinic.ts'
import { FIT } from './fit.ts'
import { FURNITURE } from './furniture.ts'
import { MEDICAL } from './medical.ts'
import { NATURE } from './nature.ts'
import { SIGNS } from './signs.ts'
import { SMALL_THINGS } from './small-things.ts'
import { STREET } from './street.ts'

for (const table of [FURNITURE, SMALL_THINGS, STREET, NATURE, SIGNS, CLINIC, FIT, MEDICAL])
  for (const [kind, generator] of Object.entries(table)) registerPropGenerator(kind, generator)
