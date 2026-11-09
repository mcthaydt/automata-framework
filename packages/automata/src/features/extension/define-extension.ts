import type { ContentSchemaDef } from '@automataframework/automata-content'
import type { GameConfig as FullGameConfig } from '@automataframework/automata-content/game-config'
import type { PluginDef } from '@automataframework/automata-sim'
import type { UiComponent, UiSlotName } from '../../shared/ui/slots/ui-slot.ts'

// Type-only imports throughout: `./extension` is loaded in Node by a game's vite.config.ts, so it must
// not reach the DOM-bound ui package, Svelte, or content's Node-only compiler at run time.

/** The parts of the game config an extension may read (content's `GameConfig`). */
export type GameConfig = Pick<FullGameConfig, 'game' | 'runtime' | 'content'>

/** What an extension may add to ruken.toml: preload files. `wants` is not a manifest field. */
export type RukenManifestContribution = {
  readonly loading?: { readonly preload?: readonly string[] }
}

/** One opt-in feature of a game. Build it with `defineExtension`. */
export interface ExtensionDef<Name extends string = string> {
  /** Kebab-case and unique. */
  readonly name: Name
  /** Names of other extensions that must come first. */
  readonly requires?: readonly string[]
  /** `definePlugin` results; they pass the determinism checker. */
  readonly sim?: readonly PluginDef[]
  /** `defineContentSchema` results. */
  readonly content?: readonly ContentSchemaDef[]
  /** Components for the named ui slots. An extension fills the slots it wants, and cannot add a slot. */
  readonly ui?: { readonly slots?: Readonly<Partial<Record<UiSlotName, UiComponent>>> }
  /** Called at build time with the game's manifest facts. */
  readonly manifest?: (config: GameConfig) => RukenManifestContribution
}

/** Returns its argument. It exists so the name keeps its literal type and `pnpm style` can find extensions. */
export function defineExtension<const N extends string>(def: ExtensionDef<N>): ExtensionDef<N> {
  return def
}
