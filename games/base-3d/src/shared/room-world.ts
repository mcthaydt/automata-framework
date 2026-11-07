// The room's world and the library it was built from (the scene reads each swatch's colour from the library), shared
// by the room that builds it and the scene that draws it.
import type { World, WorldLibrary } from '@automata/3d'

export interface RoomWorld {
  readonly world: World
  readonly library: WorldLibrary
}
