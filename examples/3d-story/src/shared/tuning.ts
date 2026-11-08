// The numbers a designer changes, in content/tuning.toml (the Tuner opens it). The compiler checks each against its
// range; this reads them once, so a missing one stops the game at boot with a sentence that says which.

/** The tunables content/tuning.toml holds. */
export interface Tuning {
  /** Wick's walk at a full push of the stick, in metres a second. */
  readonly WALK_SPEED: number
}

/** The tunables of the game's compiled content (virtual:automata/content). */
export function tuningOf(content: unknown): Tuning {
  const table = (content as { readonly tuning?: Readonly<Record<string, unknown>> } | null)?.tuning
  const speed = table?.WALK_SPEED
  if (typeof speed !== 'number' || !(speed > 0))
    throw new Error('The content has no walking speed. Check content/tuning.toml.')
  return { WALK_SPEED: speed }
}
