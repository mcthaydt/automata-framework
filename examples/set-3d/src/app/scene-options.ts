// What an example says to `scene()`: where to start, who is there, what hour it is, its one thing and its few lines.
import type { World } from '@automata/3d'
import type { AfSector2 } from '@automata/3d/level'
import type { ExtensionDef } from '@automata/framework/extension'

/** A zone id of the station's level file (`SCENE_ZONES` lists them). */
export type SceneZone = string
/** A character file's id (`SCENE_CAST` lists them). */
export type SceneCast = string

export interface SceneOptions {
  /** The zone the walked character starts in. */
  readonly start: SceneZone
  /** Who else is in the place. Default: the walked character only. */
  readonly cast?: readonly SceneCast[]
  /** The hour. Default `'day'`. */
  readonly time?: 'day' | 'dusk' | 'night'
  /** The example's one thing: an extension from a published kit. */
  readonly extensions?: readonly ExtensionDef[]
  /** The example's few lines, run when the place is built. */
  readonly on?: (scene: SceneContext) => void
}

/** What an example's few lines get to read. */
export interface SceneContext {
  readonly world: World
  readonly level: AfSector2
  readonly probe: SceneProbe
}

/** What a journey asks the page about the place: where the walker is, the hour, a rule's fact, what is carried. */
export interface SceneProbe {
  zone(): SceneZone
  time(): string
  fact(name: string): unknown
  carried(): readonly string[]
}
