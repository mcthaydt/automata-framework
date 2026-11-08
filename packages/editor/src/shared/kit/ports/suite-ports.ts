// The ports of the editor suite: what a suite editor asks of the world around it and
// does not provide. The spec owns these shapes; the code lives here, below editor-2d, editor-3d and the suite, so every
// one of them shares one definition. Types only: the fakes and the contract suites are `./ports/testing`, the Node
// adapters are `editor-suite/node`.
//
// A missing optional port is the feature off, never an error: no `gates` and the gate pill says "Gates not readable".
import type { WriteExpectation, WriteResult } from '../storage/project-store.ts'

export interface SuitePorts {
  readonly workspace: SuiteWorkspace
  readonly checks: ChecksRunner
  readonly gates?: Gates | undefined
}

/** `edit`: direct value and structure edits (an editor-list row's `modes`). */
export type EditMode = 'edit'

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
  /**
   * For a level project: the folder its game files go into (the row's `exports`), so the editor writes them with the
   * project. Absent for a file whose row names none.
   */
  readonly exports?: string | undefined
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
   * The paths of the files under a folder of the game, sorted, listed by a row of the editor list or not; empty for a
   * folder the game lacks or a path outside the root. A level reads the game's furniture and materials this way, which no
   * row names. A workspace without it gives the level only the names its own file holds.
   */
  list?(folder: string): Promise<readonly string[]>
  /**
   * Writes a file a writable row matches. `{ mtime }`: the file must still read so (a `conflict` otherwise);
   * `'absent'`: it must not exist yet (a new figure, pose or clip), and the workspace remembers it created it.
   */
  write(path: string, text: string, expected: WriteExpectation): Promise<WriteResult>
  /**
   * The bytes of any file inside the game root, for the pictures a level draws; `undefined` when there is none or the
   * path is outside the root. The served workspace has it; a workspace of text only does not.
   */
  readBytes?(path: string): Promise<Uint8Array | undefined>
  /**
   * Writes a picture (or any file) a writable row matches, under the same rules and expectation as `write`. It is not
   * an undo step: Add tiles' picture is the game's own file, kept whether or not the level that uses it is.
   */
  writeBytes?(path: string, bytes: Uint8Array, expected: WriteExpectation): Promise<WriteResult>
  /**
   * Several files as one undo step: every one is written or none is. Only the suite's own wrapper has it (an adapter's
   * `write` is the port); an editor that writes more than one file per step uses it when it is there. Each file's
   * `expected` is as `write`'s, and a file the editor already wrote in this session needs none. `force` is the
   * person's choice to write over a file that changed somewhere else (a conflict's Use mine).
   */
  writeAll?(
    files: readonly {
      readonly path: string
      readonly text: string
      readonly expected?: WriteExpectation
      readonly force?: boolean
    }[],
  ): Promise<WriteResult>
  /** Removes a file this workspace created, at the mtime it was read with; `policy` for any other file. */
  remove(path: string, expected: { readonly mtime: number }): Promise<WriteResult>
  /** A compiler output, read only (`tuning-meta.json`), or `undefined` when there is none. */
  generated(path: string): Promise<string | undefined>
}

/** A check's latest run. */
export interface CheckReport {
  readonly check: string
  readonly status: CheckResult['status']
  readonly findings: readonly CheckFinding[]
}

/** One check of the editor list (`[[check]]`). The built-in `content` check is the suite's, not the runner's. */
export interface CheckDef {
  readonly id: string
  /** `before`: runs on the candidate text and a failure refuses the write; `after`: runs on what was written (EDS-D8). */
  readonly when: 'before' | 'after'
  /** The argv the runner runs in the game's checkout, with no shell. */
  readonly run: readonly string[]
  /** Generated files a passing run adds to the game (a blockout generate). */
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
