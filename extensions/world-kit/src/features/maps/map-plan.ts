// The shape of a map plan: a level written the way a map is drawn (rectangles, a default wall for a room, sprites that are
// props or cast), which a generator makes and `convertBuilderMap` turns into an `af-sector/2` level. Anything else a plan
// carries is the level schema's to refuse.
import type { AfSector2, Decor, Dress, LampPlace, SectorDoor, Surface, WindowGrid } from '@automata/3d/level'

// What this reads of the builder's types; anything else it carries is the schema's to refuse.
export type V2 = readonly [number, number]
export interface MapPlane {
  z: number
  swatch?: Surface
  slope?: V2
  sky?: boolean
}
export interface MapWall {
  dado?: { swatch: Surface; height: number }
  rail?: number
  cornice?: { swatch: Surface; height: number }
  none?: boolean
  swatch?: Surface
  upper?: Surface
  lower?: Surface
  decor?: Decor[]
  skirting?: number
  trim?: Surface
  windows?: WindowGrid
}
export interface MapDoor extends Omit<SectorDoor, 'surface'> {
  swatch?: Surface
  shown?: number
}
export interface MapSector {
  id: string
  verts?: V2[]
  rect?: [number, number, number, number]
  floor: MapPlane
  ceil: MapPlane
  shade?: number
  grime?: number
  door?: MapDoor
  wall?: MapWall
  walls?: Record<string, MapWall>
  dress?: Dress & { dressed?: boolean }
}
export interface MapSprite {
  /** Drawn in the diorama view only (the editors); the level has no such field. */
  diorama?: boolean
  use?: string
  kind?: string
  with?: Record<string, unknown>
  who?: string
  pose?: string
  at: number[]
  angle?: number
  to?: V2
  id?: string
  layer?: string
}
export interface MapPlan {
  id: string
  name?: string
  sectors: MapSector[]
  sprites?: MapSprite[]
  lamps?: (Omit<LampPlace, 'id'> & { id?: string })[]
  time?: AfSector2['time']
  visibility?: number
  views?: AfSector2['views']
  paths?: AfSector2['paths']
  horizon?: NonNullable<AfSector2['sky']>['horizon']
  layers?: NonNullable<AfSector2['sky']>['layers']
  seed?: number
  grade?: string
  grime?: number
  reads?: AfSector2['reads']
  dress?: Dress & { dressed?: boolean }
}
