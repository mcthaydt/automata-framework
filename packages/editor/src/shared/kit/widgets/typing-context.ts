// The suite's typing registry, handed down to every field through Svelte's context. A field outside a suite (a
// standalone editor, a test) gets one of its own that flushes when the page hides.
import { getContext, setContext } from 'svelte'
import { flushOnHide } from '../storage/page-lifecycle.ts'
import { createTypingDrafts, pageTimers, type TypingDrafts } from '../storage/typing-drafts.ts'

const KEY = Symbol('typing-drafts')
let standalone: TypingDrafts | undefined

export function setTypingDrafts(drafts: TypingDrafts): void {
  setContext(KEY, drafts)
}

/** The registry of the suite this field sits in, or the page's own when there is none. */
export function typingDrafts(): TypingDrafts {
  const given = getContext<TypingDrafts | undefined>(KEY)
  if (given !== undefined) return given
  if (standalone === undefined) {
    standalone = createTypingDrafts({ timers: pageTimers, scope: 'page' })
    const drafts = standalone
    if (typeof document !== 'undefined' && typeof window !== 'undefined')
      flushOnHide({ flush: async () => drafts.flush() }, { document, window })
  }
  return standalone
}
