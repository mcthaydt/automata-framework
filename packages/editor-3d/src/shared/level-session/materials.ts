// What a level's material picker may offer (ED3D spec §4.1 and D10). The set comes from the profile: an `af-sector/2`
// file carries its own `materials` table. A level with none is not guessed at: the answer is a refusal, and the edits
// that need a list refuse with it.
import type { AfSector2File } from '@automata/3d/level'
import { swatchColour } from '@automata/3d/world-content'
import { fileTitle } from '@automata/editor/suite'
import { EMPTY_LIBRARY, type GameLibrary, worldLibrary } from './game-library'

/** The category the game's swatches are filed under in the picker. */
export const GAME_MATERIALS = 'Materials'

/** One entry of the picker: the id a level writes, the category the sheet files it under, and what it may cover. */
export interface Material {
  readonly id: string
  readonly category: string
  readonly label?: string | undefined
  /** `#rrggbb`, for a swatch the game gives a DUEL colour. */
  readonly color?: string | undefined
  /** For walls only: not offered for a floor or a ceiling. */
  readonly wallOnly?: boolean | undefined
}

export type MaterialList =
  | { readonly ok: true; readonly materials: readonly Material[] }
  | { readonly ok: false; readonly reason: string }

/** A swatch's DUEL colour as `#rrggbb`, or nothing when the game gives none. */
export function swatchHex(library: GameLibrary, name: string): string | undefined {
  const rgb = swatchColour(worldLibrary(library), name)
  return rgb === undefined ? undefined : `#${rgb.toString(16).padStart(6, '0')}`
}

/**
 * The file's `materials` table, in file order, then the game's swatches the table does not name, as one category (each
 * in words, with its colour). A level with no table and a game with no swatches has nothing to offer.
 */
export function afMaterials(level: AfSector2File, library: GameLibrary = EMPTY_LIBRARY): MaterialList {
  const table = Object.entries(level.materials ?? {}).map(([id, entry]) => ({
    id,
    category: entry.category,
    ...(entry.label === undefined ? {} : { label: entry.label }),
    ...(entry.wallOnly === undefined ? {} : { wallOnly: entry.wallOnly }),
  }))
  const named = new Set(table.map((material) => material.id))
  const game = [...library.swatches.keys()]
    .filter((id) => !named.has(id))
    .map((id): Material => {
      const color = swatchHex(library, id)
      return { id, category: GAME_MATERIALS, label: fileTitle(id), ...(color === undefined ? {} : { color }) }
    })
  if (level.materials === undefined && game.length === 0)
    return { ok: false, reason: 'the level has no materials table' }
  return { ok: true, materials: [...table, ...game] }
}
