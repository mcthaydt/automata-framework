import type { ContentSchemaDef } from '@mcthaydt/automata-content'
import type { GameConfig as FullGameConfig } from '@mcthaydt/automata-content/game-config'
import type { PluginDef } from '@mcthaydt/automata-sim'
import type { UiComponent, UiSlotName } from '@mcthaydt/automata-ui'
import type { Layer } from 'effect'

// Type-only imports throughout: `./extension` is loaded in Node by a game's vite.config.ts, so it must
// not reach the DOM-bound ui package, Svelte, or content's Node-only compiler at run time.

/** The parts of the game config an extension may read (content's `GameConfig`, DIST spec §4.4). */
export type GameConfig = Pick<FullGameConfig, 'game' | 'runtime' | 'content'>

/** What an extension may add to ruken.toml in M1: preload files. `wants` is not a manifest field (Q7). */
export type RukenManifestContribution = {
  readonly loading?: { readonly preload?: readonly string[] }
}

/** One opt-in feature of a game (M1 shared contracts §2). Build it with `defineExtension`. */
export interface ExtensionDef<Name extends string = string> {
  /** Kebab-case and unique. */
  readonly name: Name
  /** Names of other extensions that must come first. */
  readonly requires?: readonly string[]
  /** `definePlugin` results; they pass the determinism checker. */
  readonly sim?: readonly PluginDef[]
  /** `defineContentSchema` results. */
  readonly content?: readonly ContentSchemaDef[]
  /** Effect services the extension provides. They cannot fail at construction. */
  // biome-ignore lint/suspicious/noExplicitAny: a layer's service types are the extension's own.
  readonly layers?: Layer.Layer<any, never, any>
  /** Components for the named ui slots. An extension fills the slots it wants, and cannot add a slot. */
  readonly ui?: { readonly slots?: Readonly<Partial<Record<UiSlotName, UiComponent>>> }
  /** Called at build time with the game's manifest facts. */
  readonly manifest?: (config: GameConfig) => RukenManifestContribution
}

/** Returns its argument. It exists so the name keeps its literal type and `pnpm style` can find extensions. */
export function defineExtension<const N extends string>(def: ExtensionDef<N>): ExtensionDef<N> {
  return def
}
