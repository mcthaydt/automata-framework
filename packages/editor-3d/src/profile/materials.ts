// What a level's material picker may offer (ED3D spec §4.1 and D10). The set comes
// from the profile: an `af-sector/1` file carries its own `materials` table; a Last Light level's game holds its list in
// its renderer (`sectorMats` and `unlitMats` in `src/render/stage.ts`), which the host reads and hands over through the
// `ProfileContext`, as The Last Light's own `readLevelOptions` does (editor/src/server/level-options.ts, 92e6704). A list
// nobody could read is not guessed: the answer is a refusal, and the edits that need a list refuse with it.
import type { AfSector } from '../format/af-sector.schema'
import type { ProfileContext } from './level-profile'

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

/** Last Light's own sentence for a list its reader could not read (editor/src/server/level-edits.ts, 92e6704). */
export const LAST_LIGHT_NO_LIST =
  'the material keys could not be read from the renderer (src/render/stage.ts)'

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

/** The renderer's materials, in the context's order: `unlit` for those the context lists as unlit, `lit` for the rest. */
export function lastLightMaterials(context: ProfileContext | undefined): MaterialList {
  const listed = context?.materials
  if (listed === undefined || listed === null) return { ok: false, reason: LAST_LIGHT_NO_LIST }
  const unlit = new Set(context?.unlitMaterials ?? [])
  return { ok: true, materials: listed.map((id) => ({ id, category: unlit.has(id) ? 'unlit' : 'lit' })) }
}
