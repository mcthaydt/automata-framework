// The ports of the editor suite: what a suite editor asks of the world around it and
// does not provide. The spec owns these shapes; the code lives here, below editor-2d, editor-3d and the suite, so every
// one of them shares one definition. Types only: the fakes and the contract suites are `./ports/testing`, the Node
// adapters are `editor-suite/node`.
//
// A missing optional port is the feature off, never an error: no `changeSet` and edits save to the workspace with Ship
// hidden; no `gates` and the gate pill says "Gates not readable"; no `ask` and there is no Ask button.
import type { WriteExpectation, WriteResult } from '../storage/project-store.ts'

export interface SuitePorts {
  readonly workspace: SuiteWorkspace
  readonly changeSet?: ChangeSet | undefined
  readonly checks: ChecksRunner
  readonly gates?: Gates | undefined
  readonly ask?: AskProvider | undefined
}

/** `edit`: direct value and structure edits; `ask`: the assistant may propose a diff (an editor-list row's `modes`). */
export type EditMode = 'edit' | 'ask'

/** One file of the game as the editor list sees it: which editor edits it, under which rules. */
export interface WorkspaceFile {
  /** Relative to the game's root, `/`-separated. */
  readonly path: string
  /** The id of the editor whose row matched (`tuner`, `levels-3d`, ...). */
  readonly editor: string
  /** The scene the row's `{scene}` matched, when it has one. */
  readonly scene?: string | undefined
  /** The gates the row names; empty when it names none (EDS-D7). */
  readonly gates: readonly string[]
  /** The check ids the row names, `content` included when it is listed. */
  readonly checks: readonly string[]
  /** `edit`: direct edits; `ask`: the assistant may propose a diff. */
  readonly modes: readonly EditMode[]
  /** False for a file the editor may show but never write (a generated or `never` path). */
  readonly writable: boolean
  /** Why the file is not writable, for the person. */
  readonly why?: string | undefined
}

/** A path no row of the editor list matches (or one outside the game root): no editor, read only, with the reason. */
export interface UnlistedFile {
  readonly path: string
  readonly editor?: undefined
  readonly writable: false
  readonly why: string
}

/**
 * The game's files behind the editor list's policy: a kit `ProjectStore` with rules (not the kit's storage `Workspace`).
 * A write the rules refuse is `{ ok: false, reason: 'policy' }`, with the rule in the message.
 */
export interface SuiteWorkspace {
  /**
   * The files rows of the editor list match, sorted by path; only `editor`'s, or only `scene`'s, when given. A generated
   * or `never` file a row also matches is listed under that row's editor, read only with the reason.
   */
  files(editor?: string, scene?: string): Promise<WorkspaceFile[]>
  /**
   * The text and mtime of any file inside the game root, listed or not (the rules refuse writes, not reads); `undefined`
   * when there is no such file, or the path is outside the root (absolute, `..`, a backslash).
   */
  read(path: string): Promise<{ readonly text: string; readonly mtime: number } | undefined>
  /**
   * Writes a file a writable row matches. `{ mtime }`: the file must still read so (a `conflict` otherwise);
   * `'absent'`: it must not exist yet (a new figure, pose or clip), and the open change set records it as created.
   */
  write(path: string, text: string, expected: WriteExpectation): Promise<WriteResult>
  /** Removes a file the open change set created, at the mtime it was read with; `policy` for any other file. */
  remove(path: string, expected: { readonly mtime: number }): Promise<WriteResult>
  /** A compiler output, read only (`tuning-meta.json`), or `undefined` when there is none. */
  generated(path: string): Promise<string | undefined>
}

/** The change a person is working on: a branch per edit session, its files, and Ship. */
export interface ChangeSet {
  /** The open change set, or `undefined`. */
  current(): Promise<{ readonly title: string; readonly branch: string; readonly base: string } | undefined>
  /** Opens one from `title`; rejects while one is open, or when the title gives no branch name. */
  begin(title: string): Promise<void>
  /**
   * Adds written files to it, and each write's text to its journal (a write's path is recorded too); rejects when none
   * is open.
   */
  record(files: readonly string[], writes?: readonly ChangeSetWrite[]): Promise<void>
  /** Keeps each run as its check id's latest in the journal, so a reload shows the pills and measures; rejects when none is open. */
  note(checks: readonly ChangeSetCheck[]): Promise<void>
  /** Commits the files recorded since the last checkpoint; with none, gives the last commit again. */
  checkpoint(message: string): Promise<{ readonly commit: string }>
  /** Checkpoints, pushes and opens a draft PR (or gives only the compare link); the change set stays open. */
  ship(draft: { readonly title: string; readonly body: string }): Promise<{
    readonly branch: string
    readonly pushed: boolean
    readonly pr?: string | undefined
    readonly compareUrl: string
  }>
  /**
   * Records `tokens` the assistant used against the open change set; rejects when none is open, or for a count that is
   * not a whole number of zero or more. The suite records each proposal's use, rejected or accepted.
   */
  spend(tokens: number): Promise<void>
  /** Raises the open change set's token cap; only the person does this. Rejects a cap that is not above the current. */
  raiseCap(cap: number): Promise<void>
  /**
   * Closes it and goes back to the base; it then leaves `list()`. Rejects, closing nothing, while a recorded file has
   * changes no checkpoint holds ("checkpoint them first"), so a close never carries edits to the base or drops them.
   * With nothing open it does nothing.
   */
  close(): Promise<void>
  /** The open change sets, from the adapter's journal: the Review desk. */
  list(): Promise<readonly ChangeSetSummary[]>
}

export interface ChangeSetSummary {
  readonly title: string
  readonly branch: string
  readonly base: string
  /** The files recorded, sorted. */
  readonly files: readonly string[]
  /** The files it created (written with `expected: 'absent'`), sorted: the only ones `remove` may take. */
  readonly created: readonly string[]
  /** The assistant's tokens it has used, and its cap; only the person raises the cap. */
  readonly tokens: { readonly used: number; readonly cap: number }
  /** Each write in the order it happened, with its text: the Review desk's diff and an import's undo. */
  readonly writes: readonly ChangeSetWrite[]
  /** The latest run of each check id, sorted by id. */
  readonly checks: readonly ChangeSetCheck[]
}

/** One write to a file: its text before (`undefined` when the write created it) and after. */
export interface ChangeSetWrite {
  readonly path: string
  readonly before: string | undefined
  readonly after: string
}

/** A check's latest run in the journal, with its measures before the change set's writes and after them. */
export interface ChangeSetCheck {
  readonly check: string
  readonly status: CheckResult['status']
  readonly findings: readonly CheckFinding[]
  readonly before?: readonly CheckMeasure[] | undefined
  readonly after?: readonly CheckMeasure[] | undefined
}

/** One check of the editor list (`[[check]]`). The built-in `content` check is the suite's, not the runner's. */
export interface CheckDef {
  readonly id: string
  /** `before`: runs on the candidate text and a failure refuses the write; `after`: runs on what was written (EDS-D8). */
  readonly when: 'before' | 'after'
  /** The argv the runner runs in the game's checkout, with no shell. */
  readonly run: readonly string[]
  /** Generated files a passing run adds to the change set (a blockout generate). */
  readonly joins: readonly string[]
  /** True when its results carry a before-and-after measure (the Tuner's fairness). */
  readonly measure: boolean
}

/** The game's own checks. One run per check id at a time: a newer run of an id cancels that id in the older run. */
export interface ChecksRunner {
  declared(): readonly CheckDef[]
  /** `candidates`: text a `before` check reads instead of the file at that path. */
  run(request: {
    readonly checks: readonly string[]
    readonly candidates?: readonly { readonly path: string; readonly text: string }[] | undefined
  }): Promise<CheckRun>
}

export interface CheckRun {
  readonly id: string
  /**
   * One result per requested check, in request order. Never rejects: an undeclared id, a check that throws and a
   * cancelled or replaced check are each `error`, with the reason in `output`.
   */
  result(): Promise<readonly CheckResult[]>
  /** Stops the checks still running; their results are `error`. */
  cancel(): void
}

export interface CheckFinding {
  readonly path?: string | undefined
  /**
   * Where in the file, as the check printed it (`MAX_MOVE_SPEED`, `file.0.gates`): a game's check is an outside command,
   * so this is its own text; the suite's Locate turns it into a documents `KeyPath` when it can.
   */
  readonly keyPath?: string | undefined
  readonly line?: number | undefined
  readonly column?: number | undefined
  readonly severity: 'error' | 'warning'
  readonly message: string
}

export interface CheckMeasure {
  readonly id: string
  readonly label: string
  readonly value: number
  readonly threshold?: number | undefined
  readonly ok: boolean
}

export interface CheckResult {
  readonly check: string
  readonly status: 'pass' | 'warn' | 'fail' | 'error'
  readonly findings: readonly CheckFinding[]
  readonly measure?: readonly CheckMeasure[] | undefined
  /** The generated files a passing run added (its `joins`). */
  readonly joined?: readonly string[] | undefined
  readonly output: string
}

/** The recorded gate decisions: read only, never a write method. The owner decides a gate; an editor only shows it. */
export interface Gates {
  /** One state per id, in request order; an id with no record is `unknown`. Rejects when the records cannot be read. */
  states(ids: readonly string[]): Promise<readonly GateState[]>
}

export interface GateState {
  readonly id: string
  readonly name: string
  readonly decision: 'approved' | 'rejected' | 'open' | 'unknown'
  readonly decidedAt?: string | undefined
  readonly url?: string | undefined
}

/** What the editor tells the assistant beyond the document (the selected tunable, the playhead), as plain data. */
export type AskContext = Readonly<Record<string, string | number | readonly string[]>>

export interface AskRequest {
  /** What the person asked for. */
  readonly prompt: string
  /** The document's path in the workspace. */
  readonly path: string
  /** The ids of the selection the prompt is about. */
  readonly scope: readonly string[]
  /** The document as the person sees it now, so the proposal is made against it and not the last save. */
  readonly document: string
  /** The tokens the proposal may use: what is left of the change set's cap. */
  readonly budget: number
  readonly context?: AskContext | undefined
}

/** What an assistant proposes for a request: one document, whole (EDS-D9). */
export interface Proposal {
  /** One sentence for the person: what the change does. It is the undo label's text. */
  readonly summary: string
  /** The whole document as the file would read after the change; the editor reads it with its own codec. */
  readonly text: string
  /** The tokens the proposal used. */
  readonly tokens: number
}

export interface AskProvider {
  /** Rejects with the reason when the assistant fails; the document is never touched by the provider. */
  propose(request: AskRequest): Promise<Proposal>
}
