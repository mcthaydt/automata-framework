import type { ScreenDef } from '@mcthaydt/automata-runtime'
import type { PluginDef, Sim } from '@mcthaydt/automata-sim'
import { Effect } from 'effect'
import type { InputMap } from '../input/keys.ts'

/** What the default screens need from the game. */
export interface ScreensGame {
  readonly title: string
  readonly sim: {
    readonly plugins: readonly PluginDef[]
    readonly seed: number
    readonly setup?: ((sim: Sim) => void) | undefined
    readonly content?: unknown
  }
  readonly input?: InputMap | undefined
}

const notYet = (id: string): ScreenDef => ({ id, enter: () => Effect.die(new Error('not implemented')) })

/** The title, play and paused screens (DX spec §7). */
export function defaultScreens(_game: ScreensGame): ScreenDef[] {
  return [notYet('title'), notYet('play'), notYet('paused')]
}
