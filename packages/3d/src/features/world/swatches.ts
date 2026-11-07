// The swatches a level may name. A swatch is a library entry (the `world-swatch` content kind, task 7.3); the builder
// only asks whether a name is there. A name may carry a seed, `name#123`: the swatch with its texture's seed set
// (a decal's poster, a tag), so seeded variety is still a library name.
//
// Rewritten from EnvironmentBuilder (mcthaydt/EnvironmentBuilder) src/features/world/swatches.ts at 6d82a52: the
// library is handed in (a game adds its own), and an unknown name is a problem the builder reports, not a throw.

/** What the world builder reads of the library: the swatches by name. Task 7.3 adds kits, props and glyphs. */
export interface WorldLibrary {
  readonly swatches: Readonly<Record<string, unknown>>
}

/** Whether the library has the swatch, or the swatch a seeded name is made from. */
export function hasSwatch(library: WorldLibrary, name: string): boolean {
  if (Object.hasOwn(library.swatches, name)) return true
  const [base, seed] = name.split('#')
  return (
    seed !== undefined && Number.isFinite(Number(seed)) && Object.hasOwn(library.swatches, base as string)
  )
}
