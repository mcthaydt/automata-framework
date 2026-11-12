import type { Hosting } from '@automata/framework'
import { type Credits, showCredits } from '@automata/ui-screens/credits'

// The end of the night. The old prologue went on to act one, which this slice does not have, so when Ada lies down and the
// `rest` cutscene ends (or is skipped) the credits come up over the last frame. Core has no way for a game to send the player
// back to the title, so the player closes the panel and leaves by the pause menu's Back to menu.

/** The cutscene that ends the night. */
const LAST = 'rest'

/** Who made it. The Owner writes the names; these say only what the repository can say for itself. */
export const CREDITS: Credits = {
  sections: [
    {
      title: 'The Last Light',
      names: [{ name: 'A game made with Automata Framework', role: 'The engine and the editors' }],
    },
    {
      title: 'Sound and music',
      names: [{ name: 'ElevenLabs', role: 'The recorded effects and the music' }],
    },
  ],
}

export interface EndingOptions {
  /** Where the panel goes: the layer over the game. */
  readonly target: () => HTMLElement
  /** The host, asked to open a name's link (none of the credits has one). */
  readonly hosting: Pick<Hosting, 'openLink' | 'granted'>
}

export interface Ending {
  /** Takes what the sim reported this step. */
  note(events: readonly { readonly type: string; readonly payload: unknown }[]): void
  /** Takes the panel away: the night starts over. */
  reset(): void
}

export function createEnding(options: EndingOptions): Ending {
  let shown: { close(): void } | undefined
  return {
    note(events) {
      for (const event of events) {
        if (event.type !== 'cutscene.ended' || (event.payload as { id?: string }).id !== LAST) continue
        if (shown !== undefined) return
        shown = showCredits({
          target: options.target(),
          credits: CREDITS,
          hosting: options.hosting,
          onClose: () => {
            shown = undefined
          },
        })
      }
    },
    reset() {
      shown?.close()
      shown = undefined
    },
  }
}
