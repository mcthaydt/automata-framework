// The swatches a level may name, and the rest of what the builder reads from the library. A swatch is a library entry
// (the `world-swatch` content kind); the builder only asks whether a name is there. A name may carry a seed, `name#123`:
// the swatch with its texture's seed set (a decal's poster, a tag), so seeded variety is still a library name.
import { swatchRgb, worldSwatchSchema } from './content/world-swatch.schema.ts'

/**
 * What the world builder reads of the library: the swatches by name, the prop presets (a generator `kind` and its
 * parameters) and the kits the dresser dresses a room from.
 */
export interface WorldLibrary {
  readonly swatches: Readonly<Record<string, unknown>>
  readonly props?: Readonly<Record<string, Readonly<Record<string, unknown>>>> | undefined
  readonly kits?: Readonly<Record<string, unknown>> | undefined
}

/** Whether the library has the swatch, or the swatch a seeded name is made from. */
export function hasSwatch(library: WorldLibrary, name: string): boolean {
  if (Object.hasOwn(library.swatches, name)) return true
  const [base, seed] = name.split('#')
  return (
    seed !== undefined && Number.isFinite(Number(seed)) && Object.hasOwn(library.swatches, base as string)
  )
}

/** A swatch's colour as `0xRRGGBB` (a seeded name has its base's), or undefined when it has none to give. */
export function swatchColour(library: WorldLibrary, name: string): number | undefined {
  const base = Object.hasOwn(library.swatches, name) ? name : name.split('#')[0]
  const found = base === undefined ? undefined : worldSwatchSchema.safeParse(library.swatches[base])
  return found?.success === true ? swatchRgb(found.data) : undefined
}
