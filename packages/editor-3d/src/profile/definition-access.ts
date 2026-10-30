// How the editor's definition edits reach the entity definitions of a level (ED3D spec §4.7, §5.4): where a definition
// lives in the file, and what its instances call it. Only a format whose definitions are the file's own has one (AF
// sector); a profile without it has fixed definitions (Last Light's seven), and every definition edit refuses on it.
// Reading stays `LevelProfile.entities`. An id that is not there is a programmer error: the edits look first.
import type { ThingDef } from '../entities/thing-def.schema'

/** What a definition's instances are to be called: their `def`, and one member's key. */
export interface InstanceRename {
  readonly def?: string | undefined
  readonly field?: { readonly from: string; readonly to: string } | undefined
}

export interface DefinitionAccess<D> {
  /** Every definition id the file holds, readable or not, in file order. */
  ids(doc: D): readonly string[]
  /** The level with `def` at the end of its definitions. */
  add(doc: D, def: ThingDef): D
  /**
   * The level with the definition `id` written as `def` in its own place: its members in their own order, one `def`
   * does not have dropped, one it newly has appended. The level itself when nothing differs.
   */
  replace(doc: D, id: string, def: ThingDef): D
  /** The level without the definition `id`. */
  remove(doc: D, id: string): D
  /** Each instance of `def` renamed as `rename` says, each member in its own place; the level itself when none changes. */
  renameInstances(doc: D, def: string, rename: InstanceRename): D
}
