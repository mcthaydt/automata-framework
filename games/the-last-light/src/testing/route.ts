import type { BotStep } from './bot.ts'

/**
 * The old solver's order, as taps and keys: the note on the board, the lamp and the paraffin from the drawer, fill, the code
 * from the handover note into the cabinet, the supply door, the shelf's sheets, the bed made (lights out), hide behind the
 * screen until she has gone, then the bed. (The old route kept the lamp out of the way: it is lit by the fill and put out at
 * lights out, as a careful player would.)
 */
export const ROUTE: readonly BotStep[] = [
  { tap: 'noticeboard' },
  { tap: 'nightstand' },
  { tap: 'nightstand' },
  { combine: ['handLamp', 'paraffin'] },
  { tap: 'cabinet' },
  { code: '2000' },
  { tap: 'closetDoor' },
  { tap: 'shelf' },
  { tap: 'bed', held: 'sheets' },
  // Lights out: a lit lamp would show where she is, so she puts it out before she hides.
  { lamp: true },
  { hideUntil: 'figureGone', spot: 'screen' },
  { tap: 'bed' },
]

/**
 * The same night with the lamp let run dry in the supply room (Review focus 2): she waits for the tank to burn out, and the
 * nightstand always has one more bottle, so the scene can still be finished.
 */
export const DRY_ROUTE: readonly BotStep[] = [
  { tap: 'noticeboard' },
  { tap: 'nightstand' },
  { tap: 'nightstand' },
  { combine: ['handLamp', 'paraffin'] },
  { wait: 45 },
  { tap: 'nightstand' },
  { combine: ['handLamp', 'paraffin'] },
  { tap: 'cabinet' },
  { code: '2000' },
  { tap: 'closetDoor' },
  { tap: 'shelf' },
  { tap: 'bed', held: 'sheets' },
  { lamp: true },
  { hideUntil: 'figureGone', spot: 'screen' },
  { tap: 'bed' },
]
