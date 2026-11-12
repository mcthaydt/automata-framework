import { content } from 'virtual:automata/content'
import type { Hosting } from '@automata/framework'
import { type Credits, creditsSchema, showCredits } from '@automata/ui-screens/credits'

// The end of the night. The old prologue went on to act one, which this slice does not have, so when Ada lies down and the
// `rest` cutscene ends (or is skipped) the credits come up over the last frame. Core has no way for a game to send the player
// back to the title, so the player closes the panel and leaves by the pause menu's Back to menu.

/** The cutscene that ends the night. */
const LAST = 'rest'

/**
 * Who made it: `content/credits/credits.toml`, the `credits` content kind, so a person changes the names without code. The Owner
 * writes them; the file says only what the repository can say for itself. Titles and roles are in the source language until
 * `automata words` translates them.
 */
export function creditsOfContent(): Credits {
  const file = (content as unknown as { credits?: { credits?: unknown } }).credits?.credits
  return creditsSchema.parse(file ?? { sections: [] })
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
          credits: creditsOfContent(),
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
