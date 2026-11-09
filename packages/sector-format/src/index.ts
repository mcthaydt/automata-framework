// @automataframework/automata-sector-format: the one sector format (M6 spec M6-D15, M6-D17). The Build-style vocabulary
// (sectors, corners, walls with windows and doors, trims, masses) as Zod schemas, the constants a map is read with
// (`WALL_THICK`, `STEP`, `DEFAULT_TRIM`) the `occlude` member and the `af-sector/1` file envelope (`afSectorSchema`). Zod only and declared in `automata.simEntries`, so
// a sim may import it; the 3D level editor and render-pixi3d's `./camera-view` re-export it unchanged.

export * from './af-sector.schema'
export { OCCLUDES, type Occlude, occludeSchema } from './occlude'
export * from './sector.schema'
