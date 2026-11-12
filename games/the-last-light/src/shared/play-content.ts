import type { CameraView } from '@automata/3d/sim'
import type { CutsceneScript } from '@automata/cutscenes/sim'
import type { Hotspot } from '@automata/interact/sim'
import type { Canon, Storylet } from '@automata/narrative/sim'
import type { NavGraph } from '@automata/nav/sim'
import type { PuzzleDef } from '@automata/puzzle/sim'
import type { SectorMap } from '@automata/sectors/sim'
import type { CarriedLightDef, PeekFile, SystemsDef } from '@automata/systems/sim'
import type { Obstacle } from './obstacles.ts'
import type { Tuning } from './tuning.ts'

// What the sim reads as `ctx.content`: the level's rooms and hotspots, the walking graph, the puzzle, the creature, and the
// numbers. It is put together outside the sim (`app/content.ts`), which may read the level file; the sim only ever sees the
// result. Each is the game's own file, so a Save in an editor is a change in play.

/** Where Ada starts: the level's spawn. */
export interface Start {
  readonly x: number
  readonly z: number
}

/** A lamp of the level that is also a gameplay light: where she counts as in light. */
export interface Pool {
  readonly id: string
  readonly x: number
  readonly z: number
  readonly radius: number
}

/** Everything the sim holds as its content. */
export interface PlayContent {
  readonly map: SectorMap
  /** What the level's props take of the floor, found from their blockouts (`features/room/obstacles.ts`). */
  readonly obstacles: readonly Obstacle[]
  readonly hotspots: readonly Hotspot[]
  readonly start: Start
  /** The level's camera views, and the view each room takes (by the room's id). */
  readonly views: readonly CameraView[]
  readonly viewOf: Readonly<Record<string, string>>
  /** The level's lamps that have a gameplay radius (a lamp's `radius` field). */
  readonly pools: readonly Pool[]
  readonly graph: NavGraph
  readonly puzzle: PuzzleDef
  readonly systems: SystemsDef
  readonly tuning: Tuning
  /** The hand lamp's numbers (`content/carried-light.toml`) and the peek's (`content/peek.toml`). */
  readonly lamp: CarriedLightDef
  readonly peek: PeekFile
  /** The story: the canon, the storylets, and the cutscene scripts. */
  readonly canon: Canon | undefined
  readonly storylets: readonly Storylet[]
  readonly scripts: readonly CutsceneScript[]
}

/** The content a system finds in `ctx.content`: the app gives the sim a `PlayContent` (`app/content.ts`). */
export const playIn = (content: unknown): PlayContent => content as PlayContent
