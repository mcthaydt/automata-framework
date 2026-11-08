// What Watch has heard, as the diagram and the log under it need it: which mode each character is in, the arrow that just
// fired, and the last lines in words.
import { modeWords, spaced } from './pieces/piece.ts'
import type { WatchEvent } from './watch-bridge.ts'

export interface WatchState {
  /** Whether the game's debug extension has said it is listening. */
  readonly listening: boolean
  /** Each character's mode as far as it has been heard. */
  readonly modes: Readonly<Record<string, string>>
  /** The switch that fired last. */
  readonly flash: { readonly agent: string; readonly from: string; readonly to: string } | undefined
  /** The last lines, oldest first. */
  readonly lines: readonly string[]
}

export const EMPTY_WATCH: WatchState = { listening: false, modes: {}, flash: undefined, lines: [] }

const KEPT = 50

type Mode = Extract<WatchEvent, { kind: 'mode' }>

/** "12.4 s: guard went from Patrol to Hunt". */
export const watchLine = (event: Mode): string =>
  `${event.seconds.toFixed(1)} s: ${spaced(event.agent)} went from ${modeWords(event.from)} to ${modeWords(event.to)}`

export function hearWatch(state: WatchState, event: WatchEvent): WatchState {
  // The game says it is listening each time it starts, so what came before is another run.
  if (event.kind === 'ready') return { ...EMPTY_WATCH, listening: true }
  return {
    listening: true,
    modes: { ...state.modes, [event.agent]: event.to },
    flash: { agent: event.agent, from: event.from, to: event.to },
    lines: [...state.lines, watchLine(event)].slice(-KEPT),
  }
}
