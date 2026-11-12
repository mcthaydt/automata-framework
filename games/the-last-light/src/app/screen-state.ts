import type { HudModel } from '@automata/hud'

// What the HUD shows that is not the sim's: the item in hand, the examine box and whether the keypad is up. They come from
// what the sim reported (a line said, the keypad asked for) and from what the person pressed; the sim never reads them back.

/** What the puzzle says a use was at when it was not at a place: combining two items, and the keypad. */
const NOT_A_PLACE: ReadonlySet<string> = new Set(['combine', 'code'])

/** The key of a line the puzzle said: the lines file's own ids carry the scene's name before the line's. */
const lineKey = (said: string): string => `prologue.${said}`

/** The keypad takes four digits: the cabinet's code. */
export const CODE_DIGITS = 4

export interface ScreenState {
  held: string | undefined
  examine: HudModel['examine']
  keypadOpen: boolean
}

export const screen: ScreenState = { held: undefined, examine: undefined, keypadOpen: false }

/** Clears the screen's own state: a new night starts with nothing in hand and no box up. */
export function resetScreen(): void {
  screen.held = undefined
  screen.examine = undefined
  screen.keypadOpen = false
}

interface Reported {
  readonly type: string
  readonly payload: unknown
}

/**
 * Takes what the sim reported this step: a line said is shown in the examine box, under the name of the place it was said
 * at; the keypad opens when the puzzle asks for it and closes when a code was tried or a cutscene starts.
 */
export function noteEvents(events: readonly Reported[]): void {
  for (const event of events) {
    const payload = (event.payload ?? {}) as Record<string, unknown>
    if (event.type === 'puzzle.keypad') screen.keypadOpen = true
    else if (event.type === 'cutscene.started') {
      screen.keypadOpen = false
      screen.examine = undefined
    } else if (event.type === 'puzzle.said') {
      if (payload.at === 'code') screen.keypadOpen = false
      const line = payload.line
      if (typeof line === 'string' && line !== '')
        screen.examine = {
          title:
            typeof payload.at === 'string' && !NOT_A_PLACE.has(payload.at)
              ? `hotspot.${payload.at}`
              : undefined,
          line: lineKey(line),
        }
    }
  }
}
