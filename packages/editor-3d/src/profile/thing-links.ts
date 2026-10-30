// Things joined in pairs (ED3D.7c, ED3D spec §5.4 "for Last Light also nav edge add and remove"): a link joins two
// things of one definition and may pass through a third thing. A profile whose format has them says so here; one that
// has none (AF sector) leaves `LevelProfile.links` out. The editor's link edits (`model/link-edits.ts`) and the Things
// tool reach a format's links only through this, so nothing in the core names a nav edge.
import type { Geometry } from './level-profile'

/** Two things of the links' definition, by id, and what the link passes through, when it does. */
export interface ThingLink {
  readonly a: string
  readonly b: string
  readonly via?: string | undefined
}

export interface ThingLinks<D> {
  /** The definition whose things a link joins. */
  readonly def: string
  /** The level's links, in its order. */
  list(doc: D): readonly ThingLink[]
  /**
   * The level with `link` added after the others. Throws `ThingAccessError` with the sentence for a link the level may
   * not have; `geometry` is the level's, for a rule that asks where things stand.
   */
  add(doc: D, link: ThingLink, geometry: Geometry): D
  /** The level without the link between `a` and `b`, either way round. Throws `ThingAccessError` when there is none. */
  remove(doc: D, a: string, b: string): D
}
