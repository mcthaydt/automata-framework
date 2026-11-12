import { readLevel } from '@automata/3d/level'
import { cameraView } from '@automata/3d/sim'
import type { CutsceneScript } from '@automata/cutscenes/sim'
import { hotspotsOf } from '@automata/interact/sim'
import type { Canon, Storylet } from '@automata/narrative/sim'
import type { NavGraph } from '@automata/nav/sim'
import type { PuzzleDef } from '@automata/puzzle/sim'
import { readSectorMap } from '@automata/sectors/sim'
import {
  type CarriedLightFile,
  carriedLightDefOf,
  type PeekFile,
  type SystemsDef,
} from '@automata/systems/sim'
import level from '../../content/levels/prologue.af-sector.json' with { type: 'json' }
import { obstaclesOf } from '../features/room/obstacles.ts'
import { WORLD } from '../features/room/room.ts'
import type { PlayContent } from '../shared/play-content.ts'
import { tuningOf } from '../shared/tuning.ts'

// The sim's content is put together here, outside the sim: it reads the level file, which the sim must not.

type Kinds = Readonly<Record<string, Readonly<Record<string, unknown>> | undefined>>

/** The scene's name: the file name of its puzzle, nav graph and systems. */
const SCENE = 'prologue'

/** One compiled file of a kind, or a sentence that says which file is missing. */
function fileOf<T>(kinds: Kinds, kind: string, folder: string): T {
  const found = kinds[kind]?.[SCENE]
  if (found === undefined)
    throw new Error(`The game has no ${SCENE} in content/${folder}. Check content/${folder}/${SCENE}.toml.`)
  return found as T
}

/** The sim's content, from the game's compiled content. A hotspot the level declares badly is told in words. */
export function playOf(content: unknown): PlayContent {
  const kinds = content as Kinds
  const read = readLevel(level).level
  const { hotspots, problems } = hotspotsOf(read)
  if (problems.length > 0) throw new Error(`The level's hotspots have problems: ${problems.join('; ')}`)
  const spawn = (read.entities ?? []).find((entity) => entity.def === 'spawn')
  if (spawn === undefined) throw new Error('The level has no spawn point. Place one in the level editor.')
  return {
    map: readSectorMap(level).level,
    obstacles: obstaclesOf(WORLD.pieces),
    hotspots,
    start: { x: spawn.x, z: spawn.z },
    // The level names each view's numbers, and each room says which view it takes; the camera follows Ada through them.
    views: Object.entries(read.views ?? {}).map(([id, fields]) => cameraView(id, fields)),
    viewOf: Object.fromEntries(
      read.sectors.flatMap((sector) =>
        sector.view === undefined ? [] : [[sector.id, sector.view] as const],
      ),
    ),
    pools: (read.lamps ?? []).flatMap((lamp) => {
      const radius = (lamp as { radius?: unknown }).radius
      return typeof radius === 'number' && radius > 0
        ? [{ id: lamp.id, x: lamp.at[0] ?? 0, z: lamp.at[2] ?? lamp.at[1] ?? 0, radius }]
        : []
    }),
    graph: fileOf<NavGraph>(kinds, 'nav-graph', 'nav'),
    puzzle: fileOf<PuzzleDef>(kinds, 'puzzle', 'puzzles'),
    systems: fileOf<SystemsDef>(kinds, 'systems', 'systems'),
    tuning: tuningOf(content),
    lamp: carriedLightDefOf((kinds['carried-light'] ?? {}) as CarriedLightFile),
    peek: (kinds.peek ?? {}) as PeekFile,
    canon: kinds.canon?.canon as Canon | undefined,
    storylets: (kinds.storylets?.[SCENE] as { storylets: Storylet[] } | undefined)?.storylets ?? [],
    scripts: Object.values(kinds.cutscene ?? {}) as CutsceneScript[],
  }
}
