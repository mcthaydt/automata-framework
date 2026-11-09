// How Wick moves. The numbers a designer tunes are in `content/tuning.toml`, in the sim's whole numbers (Q16.16 metres
// and 60 ticks a second); the sim reads them from its content (`Area.tuning`). What stays in `constants.ts` changes what
// a tick or a metre means, not how Wick feels, so content cannot set it.

/** The tunables `content/tuning.toml` holds (each with its range there); every one is a whole number. */
export interface Tuning {
  /** Wick's walk at a full push, in Q16.16 metres a tick. */
  readonly WALK_PER_TICK: number
  /** How many ticks a roll lasts. */
  readonly ROLL_TICKS: number
  /** How far a roll carries Wick, in Q16.16 metres. */
  readonly ROLL_TRAVEL: number
}

const NAMES: readonly (keyof Tuning)[] = ['WALK_PER_TICK', 'ROLL_TICKS', 'ROLL_TRAVEL']

/**
 * A compiled `tuning` table as the sim's tunables: every one present and a whole number, or a thrown error (a wrong
 * table is a setup bug).
 */
export function tuningFrom(table: Readonly<Record<string, unknown>> | undefined | null): Tuning {
  if (table === undefined || table === null) throw new Error('base-3d: the content has no tuning')
  for (const name of NAMES)
    if (!Number.isInteger(table[name])) throw new Error(`base-3d: tuning.${name} is not a whole number`)
  return table as unknown as Tuning
}

/** The tunables of the game's compiled content (`virtual:automata/content`'s `content`). */
export function tuningOf(content: unknown): Tuning {
  return tuningFrom((content as { tuning?: Record<string, unknown> } | null)?.tuning)
}
