import { PuzzleSceneResource, PuzzleState, type Reader, type Value } from '@automata/puzzle/sim'
import type { ResourceDef } from '@automata/sim'
import type { z } from 'zod'

/** Anything that reads a resource: the sim's context, or the draw layer's read-only view of the sim. */
export interface ResourceSource {
  resource<Z extends z.ZodType>(def: ResourceDef<Z>): z.output<Z>
}

/**
 * Puzzle's facts and items, under the game's own facts, with `read.<hotspot>` for a hotspot an action was taken at.
 * The sim reads conditions through it, and so does the dialogue box (from the read-only view), so what the box offers is
 * what the sim accepts.
 */
export function puzzleReader(source: ResourceSource, own?: (name: string) => Value | undefined): Reader {
  const puzzle = source.resource(PuzzleState)
  return {
    fact: (name) => {
      const mapped = own?.(name)
      if (mapped !== undefined) return mapped
      if (name.startsWith('read.')) {
        const def = source.resource(PuzzleSceneResource).def
        const at = name.slice(5)
        return def?.actions.some((a) => a.at === at && puzzle.seen.includes(a.id)) ?? false
      }
      return puzzle.facts[name]
    },
    has: (item) => puzzle.items.includes(item),
  }
}
