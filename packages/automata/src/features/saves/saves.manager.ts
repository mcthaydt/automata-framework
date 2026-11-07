// The game's save as a runtime service, the way `Settings` is one for settings: boot builds it from
// `GameDefinition.saves`, and a screen asks for it by the same definition.

import type { HostRefusal } from '../../shared/host/errors.ts'
import { ok, type Result } from '../../shared/lib/result.ts'
import type { Save, SaveServiceOptions } from './save.manager.js'
import { saveService } from './save.manager.js'
import type { SaveDef } from './save.schema.js'

/**
 * The booted game's save as a runtime service, as `Settings` is for settings: its key and the
 * `Save`, both undefined for a game without saves.
 */
export interface Saves {
  /** The booted save's key prefix; undefined for a game without saves. */
  readonly key: string | undefined
  readonly save: Save<unknown> | undefined
}

/**
 * Returns the booted save when `def.key` matches. Throws if the game booted a different save, or none: asking for a
 * save the game never declared is the game's mistake (as `settingsStore` does for settings).
 */
export function saveOf<S>(saves: Saves, def: SaveDef<S>): Save<S> {
  if (saves.key !== def.key || saves.save === undefined)
    throw new Error(`saveOf: requested save '${def.key}' does not match the booted save '${saves.key}'`)
  return saves.save as Save<S>
}

/**
 * Opens the game's save for boot, with its triggers and its exit flush, until `dispose()`. A game without `saves`
 * gets a `Saves` that holds nothing, and nothing is read from the host.
 */
export async function createSaves(
  def: SaveDef<unknown> | undefined,
  options: SaveServiceOptions,
): Promise<Result<Saves & { dispose(): Promise<void> }, HostRefusal>> {
  if (def === undefined) return ok({ key: undefined, save: undefined, dispose: async () => undefined })
  const opened = await saveService(def, options)
  if (!opened.ok) return opened
  const save = opened.value
  return ok({ key: def.key, save, dispose: () => save.dispose() })
}
