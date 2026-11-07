// The prop generators: how a preset's `kind` becomes pieces. Core registers a box, a cylinder and the base scenes' five (`primitives.ts`); an
// extension registers more (furniture, trees, signs) under a kind a preset then names. A name core or an earlier
// extension took is refused, never replaced quietly.
import { RegistryClash } from '../../../shared/registry/registry-clash.ts'
import type { Generator } from './piece.ts'
import { PRIMITIVE_PROPS } from './primitives.ts'

const GENERATORS = new Map<string, Generator>(Object.entries(PRIMITIVE_PROPS))

/** Registers a generator under `kind`, the name a prop preset carries. Throws `RegistryClash` on a taken name. */
export function registerPropGenerator(kind: string, generator: Generator): void {
  if (GENERATORS.has(kind)) throw new RegistryClash('prop generator', kind)
  GENERATORS.set(kind, generator)
}

/** The generator of a kind, or undefined when there is none. */
export const propGenerator = (kind: string): Generator | undefined => GENERATORS.get(kind)

/** Every registered kind, core's first, in registration order. */
export const registeredPropGenerators = (): readonly string[] => [...GENERATORS.keys()]
