// The shape every level format fits (ED3D spec §4.1): what the editor core imports, so that it never names a Last Light
// concept. A profile is a file codec (read a file, write a model change back into its text) plus the two things the
// editor asks of a level: the geometry its views draw, the checks its problems list shows, and the things that stand in
// it. ED3D.2b adds the checks that need the entities, ED3D.8 the materials.
import type { CheckResult } from '../checks/check'
import type { LampKind } from '../checks/last-light/lamps'
import type { RoomPolicy } from '../checks/last-light/room-policy'
import type { EntityKit } from '../entities/things'
import type { SectorDef } from '../format/expand'
import type { MassDef } from '../format/sector.schema'
import type { NavWorld } from '../geometry/nav'
import { type ResolvedMap, resolveMap } from '../geometry/sectors'
import type { DefinitionAccess } from './definition-access'
import type { FileCodec } from './file-codec'
import type { SectorAccess } from './sector-access'
import type { ThingAccess } from './thing-access'

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

/**
 * What a profile's checks may be told about the game that holds the level: lists the level file does not carry. A check
 * whose list is absent (or `null`) is skipped and says so; the host reads each list from the game.
 */
export interface ProfileContext {
  /** Last Light: the hotspot ids the level's puzzle acts on; `null`, or absent, is a level with no puzzle. */
  readonly puzzleHotspots?: readonly string[] | null | undefined
  /** Last Light: the material ids the game's renderer has, for the `materials` check; `null`, or absent, is no list. */
  readonly materials?: readonly string[] | null | undefined
  /** Last Light: the lamp archetypes the game allows, by kind, for the `lamps` check; `null`, or absent, is no list. */
  readonly lampKinds?: Readonly<Record<string, LampKind>> | null | undefined
  /** Last Light: how far in OKLab a lamp's colour may be from its archetype's; `null`, or absent, is the game's own 0.06. */
  readonly tone?: number | null | undefined
  /**
   * Last Light: the scene's room-visibility policy, for the `policy` check. Absent is a game with none, which skips the check;
   * `null` is a policy the host could not read, which the check warns about.
   */
  readonly roomPolicy?: RoomPolicy | null | undefined
}

export interface LevelProfile<D> extends FileCodec<D> {
  /** Throws a `GeometryError` for a level that cannot be built or resolved. */
  geometry(doc: D): Geometry
  /** Never throws for a level the schema accepted: a level that cannot be built is the answer, as a result. */
  checks(doc: D, context?: ProfileContext): CheckResult[]
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
}

/** The resolved sectors, or the engine's sentence as a `GeometryError`. */
export function resolveOrThrow(defs: readonly SectorDef[], masses: readonly MassDef[] = []): ResolvedMap {
  try {
    return resolveMap(defs, masses)
  } catch (error) {
    throw new GeometryError(error instanceof Error ? error.message : String(error))
  }
}
