// The geometry and the selection ids of the editor's live level, built once for each level the editor holds, by the
// level's identity: a pointer move costs picks and snaps and not a rebuild, and an edit is a new level, so it costs one.
// A level the engine cannot build (a `GeometryError`, which the profile throws with the engine's own sentence) has no
// layers, so nothing is hit and the controllers go on working; any other error is a bug and is not hidden.
import type { LevelEditor } from '../edit/level-editor'
import { type SelectionOf, selectionOf } from '../edit/selection-of'
import { GeometryError, type GeometryLayer } from '../level-session/level-profile'

export interface Geometry<D> {
  readonly level: D
  readonly layers: readonly GeometryLayer[]
  readonly select: SelectionOf
}

export function createGeometryCache<D>(editor: Pick<LevelEditor<D>, 'profile' | 'level'>): () => Geometry<D> {
  let cache: Geometry<D> | undefined
  return () => {
    const level = editor.level
    if (cache?.level === level) return cache
    let layers: readonly GeometryLayer[] = []
    try {
      layers = editor.profile.geometry(level).layers
    } catch (error) {
      if (!(error instanceof GeometryError)) throw error
    }
    cache = { level, layers, select: selectionOf(editor.profile, level) }
    return cache
  }
}
