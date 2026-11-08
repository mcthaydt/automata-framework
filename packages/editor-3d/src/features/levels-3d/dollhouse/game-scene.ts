// What the 3D view and Walk draw (Levels 3D spec 10.3): the level as the game draws it. Core's own builder makes the
// room and its furniture from the game's materials and furniture, the things the level places stand where they are, and
// the time of day is the one the file names, so the picture is the game's and not an editor's guess. Pure data: the
// renderer draws it, and a new level (an edit) is a new scene.
import { buildWorld, levelTime, type TimeOfDay, type WorldPiece } from '@automata/3d'
import { type AfSector2File, readLevel } from '@automata/3d/level'
import { EMPTY_LIBRARY, type GameLibrary, worldLibrary } from '../../../shared/level-session/game-library'
import { gameColours } from '../../../shared/level-session/materials'
import { STAND_IN_COLOURS, type StandIn, type StandInKind, standInPieces } from './stand-ins'

export interface GameScene {
  /** The room's pieces, then the things standing in it. */
  readonly pieces: readonly WorldPiece[]
  /** A surface's colour: the game's swatch by name, or a thing's own colour. */
  readonly colourOf: (name: string) => number | undefined
  /** The time of day the level names. */
  readonly time: TimeOfDay
  /** The colour the ground gives back to the light: the floor's, as the game uses it. */
  readonly ground: number
}

/** The ground's colour when the game has no `floor` swatch: the game's day haze. */
const GROUND = 0x8690b2

const kindOfDefinition = (def: string): StandInKind => {
  if (def === 'spawn') return 'person'
  if (def.includes('goal')) return 'goal'
  if (def.includes('ember')) return 'ember'
  return 'post'
}

/** The things a level places that are not furniture: its entities, its cast and its lamps, where they stand. */
function standIns(file: AfSector2File, floorAt: (x: number, z: number) => number): StandIn[] {
  return [
    ...(file.entities ?? []).map((entity) => ({
      id: entity.id,
      kind: kindOfDefinition(entity.def),
      at: [entity.x, floorAt(entity.x, entity.z), entity.z] as const,
      angle: 0,
    })),
    ...(file.cast ?? []).map((who) => ({
      id: who.id,
      kind: 'person' as const,
      at: [who.at[0] ?? 0, floorAt(who.at[0] ?? 0, who.at[1] ?? 0), who.at[1] ?? 0] as const,
      angle: who.angle ?? 0,
    })),
    ...(file.lamps ?? []).map((lamp) => ({
      id: lamp.id,
      kind: 'lamp' as const,
      at: [lamp.at[0] ?? 0, lamp.at[2] ?? 2, lamp.at[1] ?? 0] as const,
      angle: 0,
    })),
  ]
}

/**
 * The level as the game draws it. `floorAt` answers how high the floor is under a point, for the things that stand on
 * it. A file that is not a level gives an empty scene, and a missing material draws grey, as it does in the game.
 */
export function gameScene(
  file: AfSector2File,
  library: GameLibrary = EMPTY_LIBRARY,
  floorAt: (x: number, z: number) => number = () => 0,
): GameScene {
  const colours = gameColours(library)
  const read = readLevel(file)
  const world = read.problems.length > 0 ? undefined : buildWorld(read.level, worldLibrary(library))
  return {
    pieces: [
      ...(world?.pieces ?? []),
      ...(world === undefined ? [] : standIns(file, floorAt).flatMap(standInPieces)),
    ],
    colourOf: (name) => STAND_IN_COLOURS[name] ?? colours(name),
    time: levelTime(file.time),
    ground: colours('floor') ?? GROUND,
  }
}
