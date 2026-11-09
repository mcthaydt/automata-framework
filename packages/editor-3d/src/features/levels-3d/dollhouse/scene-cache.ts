// The game's scene of the editor's live level, built once for each level the editor holds (by the level's identity, as the
// geometry is): the pointer moves and the orbit turns cost nothing, and an edit is a new level, so it costs one scene.
// A level the engine cannot build has no scene, and the views keep their flat blockout.
import type { AfSector2File } from '@automata/3d/level'
import type { LevelEditor } from '../../../shared/edit/level-editor'
import { createGeometryCache } from '../../../shared/geometry/geometry-cache'
import { floorAt } from '../../../shared/geometry/sectors'
import type { GameLibrary } from '../../../shared/level-session/game-library'
import { type GameScene, gameScene } from './game-scene'

export function createSceneCache<D>(
  editor: LevelEditor<D>,
  library: GameLibrary,
): () => GameScene | undefined {
  const geometry = createGeometryCache(editor)
  let cache: { readonly level: D; readonly scene: GameScene | undefined } | undefined
  return () => {
    const { level, layers } = geometry()
    if (cache?.level === level) return cache.scene
    const map = layers[0]?.map
    const scene =
      map === undefined ? undefined : gameScene(level as AfSector2File, library, (x, z) => floorAt(map, x, z))
    cache = { level, scene }
    return scene
  }
}
