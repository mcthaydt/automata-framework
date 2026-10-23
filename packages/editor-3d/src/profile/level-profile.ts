// The shape every level format fits (ED3D spec §4.1): what the editor core imports, so that it never names a Last Light
// concept. A profile is a file codec (read a file, write a model change back into its text) plus the two things the
// editor asks of a level: the geometry its views draw, and the checks its problems list shows. ED3D.1b2 adds the
// entities, ED3D.2b the materials and the profile's own policy checks.
import type { CheckResult } from '../checks/check'
import type { SectorDef } from '../format/expand'
import type { MassDef } from '../format/sector.schema'
import type { NavWorld } from '../geometry/nav'
import { type ResolvedMap, resolveMap } from '../geometry/sectors'
import type { FileCodec } from './file-codec'

/**
 * One layer of what a level draws. Sectors are the only kind there is; terrain and open worlds are post-launch
 * (TERRAIN.0) and arrive as another kind in this union, which is why a level's geometry is a list of layers.
 */
export type GeometryLayer = {
  readonly kind: 'sectors'
  readonly map: ResolvedMap
  /** Last Light's nav graph and clearance queries; a level without one has none. */
  readonly nav?: NavWorld | undefined
}

export interface Geometry {
  readonly layers: readonly GeometryLayer[]
}

/** A level cannot be turned into geometry: the message is the engine's own sentence (`unknown style x`). */
export class GeometryError extends Error {
  override readonly name = 'GeometryError'
}

/** What a profile's checks may be told about the game that holds the level. */
export interface ProfileContext {
  /** Last Light: the hotspot ids the level's puzzle acts on; `null`, or absent, is a level with no puzzle. */
  readonly puzzleHotspots?: readonly string[] | null | undefined
}

export interface LevelProfile<D> extends FileCodec<D> {
  /** Throws a `GeometryError` for a level that cannot be built or resolved. */
  geometry(doc: D): Geometry
  /** Never throws for a level the schema accepted: a level that cannot be built is the answer, as a result. */
  checks(doc: D, context?: ProfileContext): CheckResult[]
}

/** The resolved sectors, or the engine's sentence as a `GeometryError`. */
export function resolveOrThrow(defs: readonly SectorDef[], masses: readonly MassDef[] = []): ResolvedMap {
  try {
    return resolveMap(defs, masses)
  } catch (error) {
    throw new GeometryError(error instanceof Error ? error.message : String(error))
  }
}
