// The shape every level format fits (ED3D spec §4.1): what the editor core imports, so that it never names a Last Light
// concept. A profile is a file codec (read a file, write a model change back into its text) plus the two things the
// editor asks of a level: the geometry its views draw, the checks its problems list shows, and the things that stand in
// it. ED3D.2b adds the checks that need the entities, ED3D.8a the materials and the hints.

import type { MassDef, SectorDef } from '@automata/3d/level'
import type { CheckResult } from '../checks/check'
import type { EntityKit } from '../entities/things'
import { type ResolvedMap, resolveMap } from '../geometry/sectors'
import type { DefinitionAccess } from './definition-access'
import type { FileCodec } from './file-codec'
import type { LevelHints } from './level-hints'
import type { MaterialList } from './materials'
import type { SectorAccess } from './sector-access'
import type { ThingAccess } from './thing-access'
import type { ThingLinks } from './thing-links'

/**
 * One layer of what a level draws. Sectors are the only kind there is; terrain and open worlds are post-launch
 * (TERRAIN.0) and arrive as another kind in this union, which is why a level's geometry is a list of layers.
 */
export type GeometryLayer = {
  readonly kind: 'sectors'
  readonly map: ResolvedMap
}

export interface Geometry {
  readonly layers: readonly GeometryLayer[]
}

/** A level cannot be turned into geometry: the message is the engine's own sentence (`unknown style x`). */
export class GeometryError extends Error {
  override readonly name = 'GeometryError'
}

export interface LevelProfile<D> extends FileCodec<D> {
  /** Throws a `GeometryError` for a level that cannot be built or resolved. */
  geometry(doc: D): Geometry
  /** Never throws for a level the schema accepted: a level that cannot be built is the answer, as a result. */
  checks(doc: D): CheckResult[]
  /**
   * The definitions and the things of the level, typed (ED3D.1b2). Never throws for a level the schema accepted: what
   * cannot be read is a problem in the kit.
   */
  entities(doc: D): EntityKit
  /**
   * How the definition edits write the level's entity definitions (ED3D.13a). Absent for a format whose definitions are
   * fixed (Last Light): its definitions are read-only.
   */
  readonly definitions?: DefinitionAccess<D> | undefined
  /** How the editor's edits read and write the level's sectors (ED3D.3). */
  readonly sectors: SectorAccess<D>
  /** How the editor's edits write the level's things (ED3D.7a); reading them is `entities`. */
  readonly things: ThingAccess<D>
  /** What the material picker offers (ED3D.8a): the file's table. */
  materials(doc: D): MaterialList
  /** The unit, Walk's eye and lens, and the snap (ED3D.8a). */
  readonly hints: LevelHints
  /** The things the level joins in pairs (ED3D.7c: Last Light's nav edges); a format with none leaves it out. */
  readonly links?: ThingLinks<D> | undefined
}

/** The resolved sectors, or the engine's sentence as a `GeometryError`. */
export function resolveOrThrow(defs: readonly SectorDef[], masses: readonly MassDef[] = []): ResolvedMap {
  try {
    return resolveMap(defs, masses)
  } catch (error) {
    throw new GeometryError(error instanceof Error ? error.message : String(error))
  }
}
