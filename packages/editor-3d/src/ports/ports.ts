// The three ports of the editor (ED3D spec §4.4): what the editor asks of the world around it and does not provide.
// AF ships none of them; the Last Light server implements them for its own repo. The editor treats a missing port as
// the feature being off, and never as an error.

/** The change a person is working on in the repo: a branch, and the files that belong to it. */
export interface ChangeSet {
  current(): Promise<{ title: string; branch: string } | undefined>
  begin(title: string): Promise<void>
  record(files: string[]): Promise<void>
}

/** The command that turns the saved level into what the game reads (Last Light has one, AF sector does not). */
export interface Generator {
  command: string
  run(): Promise<{ ok: boolean; log: string }>
}

/** What an assistant proposes for a prompt. */
export interface Proposal {
  /** One sentence for the person: what the change does. It is the undo label's text. */
  readonly summary: string
  /** The whole level as the file would read after the change: the editor reads it with the profile's own codec. */
  readonly text: string
  /** The tokens the proposal used. */
  readonly tokens: number
}

export interface AskProvider {
  /**
   * `scope` is the ids of the selection the prompt is about, `budget` the tokens the proposal may use, and `document`
   * the level as the person sees it now (printed as JSON), so a proposal is made against it and not against the last save.
   */
  propose(prompt: string, scope: readonly string[], budget: number, document: string): Promise<Proposal>
}
