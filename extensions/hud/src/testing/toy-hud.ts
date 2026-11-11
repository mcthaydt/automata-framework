// A small play HUD of the extension's own, so its tests stand without a game: a file with the five pieces, words for a
// pantry, a model the test edits and a log of what the pieces asked the game to do. Tests only.
import type { UiComponent } from '@automata/framework/extension'
import { hudSlot } from '../app/hud-slot'
import type { HudFile } from '../shared/hud.schema'
import type { HudActions, HudModel } from '../shared/hud-model'

/** A line longer than a phone's width in one run, the way Portuguese and Japanese make one (Review focus 4). */
export const LONG_LINE =
  'Find the key to the supply room, then bring the paraffin back to the ward before the lamp in your hand burns dry and the night nurse hears you.'

export const WORDS: Readonly<Record<string, string>> = {
  'objective.look': 'Look around the room for something useful.',
  'objective.long': LONG_LINE,
  'name.jar': 'Jar',
  'name.cupboard': 'Cupboard',
  'hud.use': 'Use',
}

export const FILE: HudFile = {
  pieces: [
    { kind: 'objective', anchor: 'top', width: 480 },
    { kind: 'prompt', anchor: 'bottom-right', width: 240 },
  ],
}

export const idle = (): HudModel => ({
  objective: undefined,
  prompt: undefined,
  items: [],
  held: undefined,
  examine: undefined,
  keypad: { open: false, digits: 4 },
  locked: false,
})

export interface ToyHud {
  /** The model the slot reads; a test replaces it, then says a frame passed. */
  model: HudModel
  /** What the pieces asked the game for, as `name:argument`. */
  readonly calls: string[]
  readonly slot: UiComponent
}

/** A slot over `file` that reads `toy.model` and logs every action. */
export function toyHud(file: HudFile = FILE): ToyHud {
  const calls: string[] = []
  const actions: HudActions = {
    use: (at) => void calls.push(`use:${at}`),
    hold: (item) => void calls.push(`hold:${item ?? ''}`),
    examineItem: (item) => void calls.push(`examine:${item}`),
    combine: (a, b) => void calls.push(`combine:${a}+${b}`),
    code: (code) => void calls.push(`code:${code}`),
    dismiss: () => void calls.push('dismiss'),
  }
  const toy: ToyHud = {
    model: idle(),
    calls,
    slot: hudSlot({ file, words: (key) => WORDS[key], model: () => toy.model, actions }),
  }
  return toy
}
