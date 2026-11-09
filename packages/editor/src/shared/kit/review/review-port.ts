// What the Review page asks of a host: the changes waiting for the person, and what saying yes or no does. The web
// editors fill it over GitHub's REST API, and the Automata app adds playing a branch on the device. A page without a
// port has no Review row.

export type ChecksState = 'passed' | 'failed' | 'running' | 'none'

export interface WaitingChange {
  /** The pull request's number. */
  readonly id: number
  readonly title: string
  readonly author: string
  readonly branch: string
  /** "Feel, Levels (Start)": the editors the change touches. */
  readonly editors: readonly string[]
  readonly checks: ChecksState
  /** The check that failed, by name, when `checks` is `failed`. */
  readonly failedCheck?: string
}

/** A game on GitHub, and who is signed in. */
export interface ReviewGame {
  readonly repo: { readonly owner: string; readonly name: string }
  /** The signed-in person's login: their own branches are not listed, except Claude's (`claude/…`). */
  readonly me: string
}
