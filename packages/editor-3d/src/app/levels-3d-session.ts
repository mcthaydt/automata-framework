import type {
  SuiteAskTarget,
  SuitePorts,
  SuiteUndo,
  WorkspaceFile,
} from '@mcthaydt/automata-editor-kit/ports'
import { ok } from '../model/edit'
import { createLevelEditor, type LevelEditor } from '../model/level-editor'
import type { ParseIssue } from '../profile/file-codec'
import type { LevelProfile } from '../profile/level-profile'
import { readLevel } from './read-level'

// The Levels 3D session (plan EDS.2d; editor suite spec §4.1, §4.7, EDS-D12): what the suite keeps for the 3D level
// editor while the person is elsewhere. It holds the level editor (its history, selection and view: mode, layer and
// camera), so a switch and return finds them as they were. Each new step is patched into the file's text, byte for
// byte outside what changed (the codec's `patch`, as the standalone app saves), and written through the suite's
// workspace, whose write path records it for the top bar's Undo. The session's own undo and redo, and an accepted Ask
// proposal (which the suite has already written), only move the history and the text it patches from. A step the patch
// refuses, or a write the workspace refuses, is taken back with the reason. A file that cannot be opened is a state.

export interface Levels3dOptions {
  /** Milliseconds, for the history's coalescing window: the clock is the host's to inject. */
  readonly now: () => number
}

export type Levels3dState =
  | { readonly kind: 'open'; readonly editor: LevelEditor<unknown> }
  | { readonly kind: 'error'; readonly message: string; readonly issues: readonly ParseIssue[] }

export interface Levels3dSession {
  readonly path: string
  /** The other files of the row group, which this session does not open (one file per open, plan decision 2). */
  readonly others: readonly string[]
  readonly options: Levels3dOptions
  readonly state: Levels3dState
  /** Why the last step was taken back; `undefined` after one that was written. */
  readonly refusal: string | undefined
  /** The level's text as the session last wrote or took it. */
  text(): string
  /** Resolves once every write started so far has finished. */
  settled(): Promise<void>
  /** Runs `change` without writing what it does to the history (the suite's Undo and Redo, an accepted Ask). */
  quietly(change: () => void): void
  /** Takes `text` (already written) as the level, one undo step labelled `summary`; false when it does not parse. */
  take(text: string, summary: string): boolean
}

const encoder = new TextEncoder()

/** The row group's first `*.json` level, or its first file. */
function chosen(files: readonly WorkspaceFile[]): string {
  return (files.find((file) => file.path.toLowerCase().endsWith('.json')) ?? files[0])?.path ?? ''
}

function failed(
  options: Levels3dOptions,
  path: string,
  others: readonly string[],
  message: string,
  issues: readonly ParseIssue[] = [],
): Levels3dSession {
  return {
    path,
    others,
    options,
    state: { kind: 'error', message, issues },
    refusal: undefined,
    text: () => '',
    settled: () => Promise.resolve(),
    quietly: (change) => change(),
    take: () => false,
  }
}

export async function openLevels3d(
  files: readonly WorkspaceFile[],
  ports: SuitePorts,
  options: Levels3dOptions,
): Promise<Levels3dSession> {
  const path = chosen(files)
  const others = files.map((file) => file.path).filter((each) => each !== path)
  const read = path === '' ? undefined : await ports.workspace.read(path).catch(() => undefined)
  if (read === undefined)
    return failed(options, path, others, `${path || 'This row'} can’t be opened: there is no such file.`)
  const outcome = readLevel(encoder.encode(read.text))
  const name = path.split('/').pop() ?? path
  if (outcome.status === 'invalid')
    return failed(
      options,
      path,
      others,
      `${name} can’t be opened as a ${outcome.profile.id} level.`,
      outcome.issues,
    )
  if (outcome.status !== 'parsed') {
    const why = outcome.status === 'unrecognised' ? ` ${outcome.message}` : ''
    return failed(options, path, others, `${name} can’t be opened as a level.${why}`)
  }

  const profile: LevelProfile<unknown> = outcome.profile
  const editor = createLevelEditor({ profile, level: outcome.value, now: options.now })
  /** The text the file holds (as far as this session knows) and the level it parses to: what the next patch is from. */
  let base = { text: read.text, model: outcome.value }
  let mtime = read.mtime
  let quiet = false
  let queue: Promise<void> = Promise.resolve()

  const session = {
    path,
    others,
    options,
    state: { kind: 'open', editor } as const,
    refusal: undefined as string | undefined,
    text: () => base.text,
    settled: () => queue,
    quietly(change: () => void) {
      const was = quiet
      quiet = true
      try {
        change()
      } finally {
        quiet = was
      }
    },
    take(text: string, summary: string) {
      const parsed = profile.parse(text)
      if (!parsed.ok) return false
      session.quietly(() => editor.run({ id: 'suite.ask', label: summary, run: () => ok(parsed.value) }))
      base = { text, model: parsed.value }
      return true
    },
  }

  const refuse = (why: string): void => {
    session.refusal = why
    session.quietly(() => editor.history.undo())
  }

  editor.history.subscribe(() => {
    const model = editor.history.state.level
    if (model === base.model) return
    const patched = profile.patch(base.text, base.model, model)
    if (!patched.ok) {
      if (!quiet) refuse(`${patched.detail} The step was taken back.`)
      return
    }
    base = { text: patched.text, model }
    if (quiet) return
    const { text } = patched
    // Writes run one at a time, each with the text its step left.
    queue = queue.then(async () => {
      const result = await ports.workspace.write(path, text, { mtime })
      if (result.ok) {
        mtime = result.mtime
        session.refusal = undefined
      } else refuse(result.message)
    })
  })
  return session
}

const NO_UNDO: SuiteUndo = {
  canUndo: () => false,
  canRedo: () => false,
  undoLabel: () => undefined,
  redoLabel: () => undefined,
  undo: () => {},
  redo: () => {},
  subscribe: () => () => {},
}

/** The level's history as the suite's top bar sees it; a file that did not open has nothing to undo. */
export function levels3dUndo(session: Levels3dSession): SuiteUndo {
  const { state } = session
  if (state.kind !== 'open') return NO_UNDO
  const { history } = state.editor
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

/** The level as Ask sees it: its text, the selection the prompt is about, and the taking of an accepted text. */
export function levels3dAsk(session: Levels3dSession): SuiteAskTarget {
  const { state } = session
  return {
    path: session.path,
    text: () => session.text(),
    scope: () => (state.kind === 'open' ? state.editor.selection.ids : []),
    locked: () => [],
    accept: (text, summary) => {
      session.take(text, summary)
    },
  }
}
