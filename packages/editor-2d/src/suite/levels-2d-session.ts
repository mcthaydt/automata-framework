import { createHistory, type History } from '@mcthaydt/automata-editor-kit/core'
import type { SuitePorts, SuiteUndo, WorkspaceFile } from '@mcthaydt/automata-editor-kit/ports'
import { createLevelSession, type LevelSession } from '../app/level/level-session'
import { createAppProfiles } from '../app/profiles'
import { readDocument } from '../app/read-document'
import type { IdSource } from '../model/ids'
import type { ParseError, Profile } from '../profiles/profile'

// The Levels 2D session (plan EDS.2d; editor suite spec §4.1, §4.7, EDS-D12): what the suite keeps for the 2D level
// editor while the person is elsewhere. It holds the document's kit history and the Level view's session (the level,
// layer, tool, selection and camera), so a switch and return finds them as they were. Every new step is written through
// the suite's workspace, whose write path records it for the top bar's Undo; the session's own undo and redo only move
// the history back, because that write path has already put the file back. A file that cannot be opened is a state.

export interface Levels2dOptions {
  /** Where the ids of placed instances come from. */
  readonly ids: IdSource
}

export type Levels2dState =
  | {
      readonly kind: 'open'
      readonly profile: Profile<unknown>
      readonly history: History<unknown>
      readonly level: LevelSession
    }
  | { readonly kind: 'error'; readonly message: string; readonly errors: readonly ParseError[] }

export interface Levels2dSession {
  readonly path: string
  /** The other files of the row group, which this session does not open (one file per open, plan decision 2). */
  readonly others: readonly string[]
  readonly state: Levels2dState
  /** Why the last write was refused (that step was taken back); `undefined` after a write that went through. */
  readonly refusal: string | undefined
  /** Resolves once every write started so far has finished. */
  settled(): Promise<void>
  /** Runs `change` without writing what it does to the history (the suite's Undo and Redo). */
  quietly(change: () => void): void
}

const encoder = new TextEncoder()

/** The row group's first level project (`*.af2d.json`), or its first file. */
function chosen(files: readonly WorkspaceFile[]): string {
  return (files.find((file) => file.path.toLowerCase().endsWith('.af2d.json')) ?? files[0])?.path ?? ''
}

function failed(
  path: string,
  others: readonly string[],
  message: string,
  errors: readonly ParseError[] = [],
) {
  const session: Levels2dSession = {
    path,
    others,
    state: { kind: 'error', message, errors },
    refusal: undefined,
    settled: () => Promise.resolve(),
    quietly: (change) => change(),
  }
  return session
}

export async function openLevels2d(
  files: readonly WorkspaceFile[],
  ports: SuitePorts,
  options: Levels2dOptions,
): Promise<Levels2dSession> {
  const path = chosen(files)
  const others = files.map((file) => file.path).filter((each) => each !== path)
  const read = path === '' ? undefined : await ports.workspace.read(path).catch(() => undefined)
  if (read === undefined)
    return failed(path, others, `${path || 'This row'} can’t be opened: there is no such file.`)
  const name = path.split('/').pop() ?? path
  const outcome = readDocument(createAppProfiles(), name, encoder.encode(read.text))
  if (outcome.status !== 'parsed') {
    const errors = outcome.status === 'invalid' ? outcome.errors : []
    return failed(path, others, `${name} can’t be opened as a level project.`, errors)
  }

  const { profile } = outcome
  const history = createHistory<unknown>(outcome.value)
  const level = createLevelSession({ history, ids: options.ids })
  if (level === undefined) return failed(path, others, `${name} can’t be opened: it has no level to draw.`)

  const base = read.text
  let mtime = read.mtime
  let quiet = false
  let queue: Promise<void> = Promise.resolve()
  const session = {
    path,
    others,
    state: { kind: 'open', profile, history, level } as const,
    refusal: undefined as string | undefined,
    settled: () => queue,
    quietly(change: () => void) {
      quiet = true
      try {
        change()
      } finally {
        quiet = false
      }
    },
  }

  // Writes run one at a time, each with the text its step left; a refused one takes that step back quietly.
  history.subscribe(() => {
    if (quiet) return
    const text = profile.print(base, history.state)
    queue = queue.then(async () => {
      const result = await ports.workspace.write(path, text, { mtime })
      if (result.ok) {
        mtime = result.mtime
        session.refusal = undefined
        return
      }
      session.refusal = result.message
      session.quietly(() => history.undo())
    })
  })
  return session
}

/** The session's history as the suite's top bar sees it; a file that did not open has nothing to undo. */
export function levels2dUndo(session: Levels2dSession): SuiteUndo {
  const { state } = session
  if (state.kind !== 'open') {
    return {
      canUndo: () => false,
      canRedo: () => false,
      undoLabel: () => undefined,
      redoLabel: () => undefined,
      undo: () => {},
      redo: () => {},
      subscribe: () => () => {},
    }
  }
  const { history } = state
  return {
    canUndo: () => history.canUndo,
    canRedo: () => history.canRedo,
    undoLabel: () => history.undoLabel,
    redoLabel: () => history.redoLabel,
    undo: () => session.quietly(() => history.undo()),
    redo: () => session.quietly(() => history.redo()),
    subscribe: (listener) => history.subscribe(() => listener()),
  }
}
