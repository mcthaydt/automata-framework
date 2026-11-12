import type { Hosting } from '@automataframework/framework'
import { mount, unmount } from 'svelte'
import CreditsPanel from '../features/credits/CreditsPanel.svelte'
import type { Credits } from '../shared/credits/credits.schema.ts'
import { type CreditsCopy, screensWords } from '../shared/words/screens-words.ts'

/** What `showCredits` needs. */
export interface ShowCreditsOptions {
  /** Where the panel goes: a screen's layer. */
  readonly target: HTMLElement
  readonly credits: Credits
  /** The host, asked to open a name's link. */
  readonly hosting: Pick<Hosting, 'openLink' | 'granted'>
  /** The panel's words. Default: this package's, in `locale` (English without one). */
  readonly copy?: CreditsCopy
  readonly locale?: string
  /** The game's lookup for translated titles and roles (see `CreditsPanel`). */
  readonly text?: (section: number, name: number | undefined, authored: string) => string
  /** Called once when the panel closes, by Escape, Close or `close()`. */
  readonly onClose?: () => void
}

/**
 * Shows the credits panel in `target` for a game that is plain TypeScript and has no Svelte of its own to mount it with.
 * Returns how to close it; closing twice is harmless.
 */
export function showCredits(options: ShowCreditsOptions): { close(): void } {
  const words = options.copy ?? screensWords(options.locale ?? 'en').credits
  let panel: ReturnType<typeof mount> | undefined
  const close = (): void => {
    if (panel === undefined) return
    void unmount(panel)
    panel = undefined
    options.onClose?.()
  }
  panel = mount(CreditsPanel, {
    target: options.target,
    props: {
      credits: options.credits,
      copy: words,
      onClose: close,
      hosting: options.hosting,
      ...(options.text === undefined ? {} : { text: options.text }),
    },
  })
  return { close }
}
