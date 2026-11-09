// The room's world and the library it was built from (the scene reads each swatch's colour from the library), shared
// by the room that builds it and the scene that draws it.
import type { World, WorldLibrary } from '@automata/3d'
import type { AfSector2 } from '@automata/3d/level'

export interface RoomWorld {
  readonly level: AfSector2
  readonly world: World
  readonly library: WorldLibrary
}
