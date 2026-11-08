// What a level's material picker may offer (ED3D spec §4.1 and D10). The set comes from the profile: an `af-sector/1`
// file carries its own `materials` table. A level with none is not guessed at: the answer is a refusal, and the edits
// that need a list refuse with it.
import type { AfSector } from '@automata/3d/level'

/** One entry of the picker: the id a level writes, the category the sheet files it under, and what it may cover. */
export interface Material {
  readonly id: string
  readonly category: string
  readonly label?: string | undefined
  /** For walls only: not offered for a floor or a ceiling. */
  readonly wallOnly?: boolean | undefined
}

export type MaterialList =
  | { readonly ok: true; readonly materials: readonly Material[] }
  | { readonly ok: false; readonly reason: string }

/** The file's `materials` table, in file order; a level with no table has nothing to offer. */
export function afMaterials(level: AfSector): MaterialList {
  if (level.materials === undefined) return { ok: false, reason: 'the level has no materials table' }
  return {
    ok: true,
    materials: Object.entries(level.materials).map(([id, entry]) => ({
      id,
      category: entry.category,
      ...(entry.label === undefined ? {} : { label: entry.label }),
      ...(entry.wallOnly === undefined ? {} : { wallOnly: entry.wallOnly }),
    })),
  }
}
