// Typed words are written while they are typed, not when the field is left. A field registers here; the registry
// commits its text 500 ms after the last input (or at once on leaving), tells the suite how many fields hold text that
// has not been committed yet, and keeps that text in the browser's own storage until the commit has landed, so a page
// that goes away inside the half second gets the words back on the next open. Plain TypeScript: no DOM, no clock of
// its own (the timers are given).

/** How long after the last key a field's text is written. */
export const TYPING_DELAY_MS = 500
/** A visit to a field closes this long after the field was left, if the write was not seen before. */
const VISIT_CLOSE_MS = 1000

const PREFIX = 'af-draft'

/** The part of `localStorage` the drafts use; absent or throwing, there are no drafts and nothing else changes. */
export interface DraftStorage {
  getItem(key: string): string | null
  setItem(key: string, value: string): void
  removeItem(key: string): void
}

export interface TypingTimers {
  /** Runs `run` after `ms`; the result cancels it. */
  after(ms: number, run: () => void): () => void
}

/** Timers on the page's clock. */
export const pageTimers: TypingTimers = {
  after(ms, run) {
    const id = setTimeout(run, ms)
    return () => clearTimeout(id)
  },
}

/** The page's `localStorage`, or none where the browser refuses it (some private windows, blocked site data). */
export function browserDraftStorage(): DraftStorage | undefined {
  try {
    const storage = (globalThis as { localStorage?: DraftStorage }).localStorage
    // Reading a property is where a blocked store throws.
    storage?.getItem(`${PREFIX}\u0001probe`)
    return storage
  } catch {
    return undefined
  }
}

export interface TypingFieldOptions {
  /** Names the field inside its editor, so a draft can find it again after the page is gone. No key, no draft. */
  readonly key?: string | undefined
  /** What the field reads now; a draft is offered back only to a field that still reads what it was typed over. */
  readonly current?: (() => string) | undefined
  /** False for a text that is not a value yet ("0." on its way to "0.5"): it waits instead of being committed. */
  readonly valid?: ((value: string) => boolean) | undefined
  /** The field names something other files point at: it commits on leaving and on a flush, never on a pause. */
  readonly leaveOnly?: boolean | undefined
}

export interface TypingField {
  /** The person typed `value`. */
  typed(value: string): void
  /** The person went into the field: a visit to it begins. */
  entered(): void
  /** The person left the field with `value` in it. */
  left(value: string): void
  /** The field is going away: its waiting text is committed first. */
  dispose(): void
}

/**
 * Writes `value`. `leaving` is true when the person has left the field (or it is going away): that is when a refusal
 * may be said and the field put back. Returns false when the value was refused, so leaving retries it.
 */
export type TypingCommit = (value: string, leaving: boolean) => void | boolean

export interface TypingDrafts {
  field(commit: TypingCommit, options?: TypingFieldOptions): TypingField
  /** Commits every waiting field now. */
  flush(): void
  /** How many fields hold typed text that has not been committed. */
  readonly waiting: number
  /** Where the fields being made now sit (the open editor's id); part of every draft's key. */
  place: string
  /** The key of the open visit; writes made during it join one Undo step. */
  visit(): string | undefined
  /** The write path saw a write; a visit whose field was left closes. */
  wrote(): void
  subscribe(listener: () => void): () => void
}

export interface TypingDraftsDeps {
  readonly timers: TypingTimers
  readonly drafts?: DraftStorage | undefined
  /** The game, so two games' drafts never meet. */
  readonly scope: string
}

interface Draft {
  readonly value: string
  readonly base: string
}

interface FieldState {
  waiting: string | undefined
  /** The text last committed in this visit, so the same text is never committed twice. */
  sent: string | undefined
  /** What the field read when the waiting text was begun. */
  base: string | undefined
  cancel: (() => void) | undefined
  readonly commit: TypingCommit
  readonly options: TypingFieldOptions
  /** The draft's key in storage: the field's key inside its place. */
  readonly key: string | undefined
}

export function createTypingDrafts({ timers, drafts, scope }: TypingDraftsDeps): TypingDrafts {
  const listeners = new Set<() => void>()
  const fields = new Set<FieldState>()
  const notify = () => {
    for (const listener of listeners) listener()
  }

  let visits = 0
  let visitKey: string | undefined
  let visitLeft = false
  let cancelClose: (() => void) | undefined
  const closeVisit = () => {
    cancelClose?.()
    cancelClose = undefined
    visitKey = undefined
    visitLeft = false
  }

  const storeKey = (key: string) => `${PREFIX}\u0001${scope}\u0001${key}`
  function readDraft(key: string): Draft | undefined {
    try {
      const raw = drafts?.getItem(storeKey(key))
      if (raw === null || raw === undefined) return undefined
      const parsed: unknown = JSON.parse(raw)
      if (typeof parsed !== 'object' || parsed === null) return undefined
      const { value, base } = parsed as Record<string, unknown>
      return typeof value === 'string' && typeof base === 'string' ? { value, base } : undefined
    } catch {
      return undefined
    }
  }
  function writeDraft(key: string | undefined, draft: Draft): void {
    if (key === undefined) return
    try {
      drafts?.setItem(storeKey(key), JSON.stringify(draft))
    } catch {
      // A browser that keeps no drafts loses up to half a second of typing to a reload, and nothing else.
    }
  }
  function removeDraft(key: string | undefined): void {
    if (key === undefined) return
    try {
      drafts?.removeItem(storeKey(key))
    } catch {
      // Same as above.
    }
  }

  function commitNow(state: FieldState, value: string, leaving: boolean): void {
    state.cancel?.()
    state.cancel = undefined
    state.waiting = undefined
    state.base = undefined
    let refused = false
    if (value !== state.sent) {
      state.sent = value
      if (state.commit(value, leaving) === false) {
        state.sent = undefined
        refused = true
      }
    }
    // A text the field refused stays a draft until the person has left the field and been told why.
    if (!refused || leaving) removeDraft(state.key)
    notify()
  }

  const api: TypingDrafts = {
    place: '',
    field(commit, options = {}) {
      const state: FieldState = {
        waiting: undefined,
        sent: undefined,
        base: undefined,
        cancel: undefined,
        commit,
        options,
        key: options.key === undefined ? undefined : `${api.place}\u0002${options.key}`,
      }
      fields.add(state)

      // A draft the last page left behind is the person's edit if the field still reads what it was typed over.
      const key = state.key
      const current = options.current?.()
      if (key !== undefined && current !== undefined) {
        const draft = readDraft(key)
        if (draft !== undefined) {
          if (draft.base === current && draft.value !== current) {
            queueMicrotask(() => {
              state.sent = draft.value
              commit(draft.value, false)
              removeDraft(key)
            })
          } else removeDraft(key)
        }
      }

      return {
        typed(value) {
          state.base ??= options.current?.() ?? ''
          state.waiting = value
          writeDraft(state.key, { value, base: state.base })
          state.cancel?.()
          state.cancel = undefined
          if (options.leaveOnly !== true && (options.valid?.(value) ?? true))
            state.cancel = timers.after(TYPING_DELAY_MS, () => commitNow(state, value, false))
          notify()
        },
        entered() {
          if (visitKey !== undefined && !visitLeft) return
          closeVisit()
          visitKey = `visit-${String(++visits)}`
        },
        left(value) {
          commitNow(state, value, true)
          state.sent = undefined
          if (visitKey !== undefined) {
            visitLeft = true
            cancelClose?.()
            cancelClose = timers.after(VISIT_CLOSE_MS, closeVisit)
          }
        },
        dispose() {
          if (state.waiting !== undefined) commitNow(state, state.waiting, true)
          fields.delete(state)
        },
      }
    },
    flush() {
      for (const state of [...fields]) if (state.waiting !== undefined) commitNow(state, state.waiting, false)
    },
    get waiting() {
      let count = 0
      for (const state of fields) if (state.waiting !== undefined) count++
      return count
    },
    visit: () => visitKey,
    wrote() {
      if (visitLeft) closeVisit()
    },
    subscribe(listener) {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
  }
  return api
}
