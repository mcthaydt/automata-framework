// The game's save as a runtime service (M5 spec §4.3, §5), the way `Settings` is one for settings: boot builds it from
// `GameDefinition.saves`, and a screen asks for it by the same definition.
import type { HostError, Hosting } from '@mcthaydt/automata-host'
import { Context, Effect, type Scope } from 'effect'
import type { PresentationBus } from '../presentation/presentation-bus.manager.js'
import type { Save } from './save.manager.js'
import { saveService } from './save.manager.js'
import type { SaveDef } from './save.schema.js'

/**
 * The booted game's save as a runtime service (M5 spec §4.3), as `Settings` is for settings: its key and the
 * `Save`, both undefined for a game without saves.
 */
export interface Saves {
  /** The booted save's key prefix; undefined for a game without saves. */
  readonly key: string | undefined
  readonly save: Save<unknown> | undefined
}

export const Saves: Context.Tag<Saves, Saves> = Context.GenericTag<Saves>('@mcthaydt/automata-runtime/Saves')

/**
 * Returns the booted save when `def.key` matches.
 * Dies with a defect if the game booted a different save, or none: asking for a save the game never declared is
 * the game's mistake (as `settingsStore` does for settings).
 */
export function saveOf<S>(def: SaveDef<S>): Effect.Effect<Save<S>, never, Saves> {
  return Effect.gen(function* () {
    const saves = yield* Saves
    if (saves.key !== def.key || saves.save === undefined) {
      return yield* Effect.dieMessage(
        `saveOf: requested save '${def.key}' does not match the booted save '${saves.key}'`,
      )
    }
    return saves.save as Save<S>
  })
}

/**
 * Opens the game's save for boot, with its triggers and its exit flush, for as long as the scope is open. A game
 * without `saves` gets a `Saves` that holds nothing, and nothing is read from the host.
 */
export function makeSaves(
  def: SaveDef<unknown> | undefined,
  options: { readonly contentHash: string },
): Effect.Effect<Saves, HostError, Hosting | PresentationBus | Scope.Scope> {
  if (def === undefined) return Effect.succeed({ key: undefined, save: undefined })
  return saveService(def, options).pipe(Effect.map((save) => ({ key: def.key, save })))
}
