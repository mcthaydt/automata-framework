// @automata/3d/level: the one sector format. The Build-style vocabulary
// (sectors, corners, walls with windows and doors, trims, masses) as Zod schemas, the constants a map is read with
// (`WALL_THICK`, `STEP`, `DEFAULT_TRIM`) the `occlude` member, the `af-sector/1` file envelope (`afSectorSchema`) and
// `af-sector/2`, the format the game, the editor and the world read: its schema, `readLevel` (either format in, `/2` out),
// the migration, and the states a world's pieces are in while a scene plays (`PieceStates`), and the one sector geometry (point tests,
// openings, triangulation). Zod only and declared in `automata.simEntries`, so
// a sim may import it; the 3D level editor and @automata/3d's `./camera-view` re-export it unchanged.

export * from '../shared/level/af-sector.schema.ts'
export { migrateAfSector1 } from '../shared/level/af-sector-1-to-2.migration.ts'
export * from '../shared/level/af-sector-2.schema.ts'
export {
  crossing,
  insideSector,
  opening,
  polygonArea,
  type SectorPlan,
  segmentDistance,
  type Triangle,
  type Triangulation,
  triangulate,
  type WallSpan,
  walkBlocker,
} from '../shared/level/geometry.ts'
export { OCCLUDES, type Occlude, occludeSchema } from '../shared/level/occlude.ts'
export {
  doorOpen,
  type LampState,
  lampState,
  noPieceStates,
  type PieceStates,
  type PropState,
  propState,
  sameProp,
} from '../shared/level/piece-states.ts'
export { type LevelPath, type LevelProblem, pathText } from '../shared/level/problem.ts'
export { type LevelRead, readLevel } from '../shared/level/read-level.ts'
export * from '../shared/level/sector.schema.ts'
