// What the default title does with a game's save: the slot list as the screen
// shows it, and the three things a player does with a slot. A slot is taken before play starts, so a load or write
// the host refuses leaves the player on the title with the row marked, not in a game that cannot be kept.

import { Effect, type Scope } from 'effect'
import { formatDateTime } from '../../../features/locale/format.ts'
import type { Save } from '../../../features/saves/save.manager.ts'
import { saveOf } from '../../../features/saves/saves.manager.ts'
import { Locale, Saves } from '../../boot/effect-tags.ts'
import type { GameSaves } from '../../define-game.ts'
import { orDispose, orThrow, type SavesStart } from './saves-start.ts'
import { createSlotsModel, type SlotsModel } from './saves-view.svelte.ts'

/** What the title needs to list a game's slots. */
export interface TitleSaves {
  /** The slot list and the writes in flight; the screen changes it in place. */
  readonly model: SlotsModel
  /** How a save's time reads, in the player's locale. */
  readonly formatTime: (savedAt: number) => string
  readonly onLoad: (slot: number) => void
  readonly onNew: (slot: number) => void
  readonly onDelete: (slot: number) => void
}

/**
 * The title's slot list for a game's save, kept up to date for as long as the screen is open. The slots shown first
 * are the ones the runtime already holds, so the list is never a frame of "loading" for a save that has been read.
 */
export function titleSaves(
  saves: GameSaves<unknown>,
  start: SavesStart,
): Effect.Effect<TitleSaves, never, Saves | Locale | Scope.Scope> {
  return Effect.gen(function* () {
    const save: Save<unknown> = saveOf(yield* Saves, saves.def)
    const locale = yield* Locale
    const model = createSlotsModel()
    const stopSlots = save.slots.subscribe((states) => model.set(states))
    yield* Effect.addFinalizer(() => Effect.sync(stopSlots))

    // One thing at a time: a second tap while a slot is loading must not start a second game.
    let busy = false
    const attempt = (slot: number, work: () => Promise<void>): void => {
      if (busy) return
      busy = true
      model.mark(slot, undefined)
      void work()
        .catch(() => model.mark(slot, 'failed'))
        .finally(() => {
          busy = false
        })
    }

    return {
      model,
      formatTime: (savedAt) => formatDateTime(locale.current, savedAt),
      onLoad: (slot) =>
        attempt(slot, async () => {
          const loaded = await orThrow(save.load(slot))
          const sim = await start.fresh()
          await orDispose(sim, () => saves.apply(sim, loaded.data))
          start.play(sim)
        }),
      // New game takes the slot first (`load` of an empty slot is the empty data and makes it the one touched), then
      // writes the starting data, so play never begins in a slot that was not written.
      onNew: (slot) =>
        attempt(slot, async () => {
          model.mark(slot, 'writing')
          await orThrow(save.load(slot))
          const sim = await start.fresh()
          const label = saves.label?.(slot)
          await orDispose(sim, () =>
            orThrow(save.write(slot, saves.capture(sim), label === undefined ? {} : { label })),
          )
          start.play(sim)
        }),
      onDelete: (slot) => attempt(slot, () => orThrow(save.remove(slot))),
    }
  })
}
