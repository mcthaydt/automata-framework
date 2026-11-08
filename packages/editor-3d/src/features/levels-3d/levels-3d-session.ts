import { afFormatVersion } from '@automata/3d/level'
import type { SuitePorts, SuiteUndo, WorkspaceFile } from '@automata/editor/kit/ports'
import { fileTitle } from '@automata/editor/suite'
import { ok } from '../../shared/edit/edit'
import { createLevelEditor, type LevelEditor } from '../../shared/edit/level-editor'
import { afSectorProfile, afSectorProfileFor } from '../../shared/level-session/af-sector-profile'
import type { ParseIssue } from '../../shared/level-session/file-codec'
import { EMPTY_LIBRARY, type GameLibrary, readGameLibrary } from '../../shared/level-session/game-library'
import type { LevelProfile } from '../../shared/level-session/level-profile'
import { readLevel } from './document/read-level'

// The Levels 3D session (plan EDS.2d; editor suite spec §4.1, §4.7, EDS-D12): what the suite keeps for the 3D level
// editor while the person is elsewhere. It holds the level editor (its history, selection and view: mode, layer and
// camera), so a switch and return finds them as they were. Each new step is patched into the file's text, byte for
// byte outside what changed (the codec's `patch`, as the standalone app saves), and written through the suite's
// workspace, whose write path records it for the top bar's Undo. The session's own undo and redo only move the history
// and the text it patches from, because that write path has already put the file back. A step the patch
// refuses, or a write the workspace refuses, is taken back with the reason. A file that cannot be opened is a state.

export interface Levels3dOptions {
  /** Milliseconds, for the history's coalescing window: the clock is the host's to inject. */
  readonly now: () => number
}

export type Levels3dState =
  | { readonly kind: 'open'; readonly editor: LevelEditor<unknown> }
  | {
      readonly kind: 'error'
      /** The heading: "<File> can't be opened." */
      readonly message: string
      /** Why, in words a person can read. */
      readonly reason: string
      /** The schema's own issues, shown only behind "Details". */
      readonly details: readonly ParseIssue[]
    }

export interface Levels3dSession {
  readonly path: string
  /** The other files of the row group, which this session does not open (one file per open, plan decision 2). */
  readonly others: readonly string[]
  readonly options: Levels3dOptions
  readonly state: Levels3dState
  /** Why the last step was taken back; `undefined` after one that was written. */
  readonly refusal: string | undefined
  /** The file is from an older version: its first change writes it in the current one, and nothing in it is lost. */
  readonly upgraded: boolean
  /** The game's furniture, materials and characters the level is read against; empty for a game that has none. */
  readonly library: GameLibrary
  /** The level's text as the session last wrote or took it. */
  text(): string
  /** Resolves once every write started so far has finished. */
  settled(): Promise<void>
  /** Runs `change` without writing what it does to the history (the suite's Undo and Redo). */
  quietly(change: () => void): void
}

const encoder = new TextEncoder()

const formatOf = (text: string): string => {
  try {
    const format = (JSON.parse(text) as { format?: unknown } | null)?.format
    return typeof format === 'string' ? format : ''
  } catch {
    return ''
  }
}

const NEWER = 'It was made by a newer version of AF. Update AF, then open it again.'
const UNREADABLE = "Something in it isn't written the way a room is. Details says where."

/** The row group's first `*.json` level, or its first file. */
function chosen(files: readonly WorkspaceFile[]): string {
  return (files.find((file) => file.path.toLowerCase().endsWith('.json')) ?? files[0])?.path ?? ''
}

function failed(
  options: Levels3dOptions,
  path: string,
  others: readonly string[],
  reason: string,
  details: readonly ParseIssue[] = [],
): Levels3dSession {
  return {
    path,
    others,
    options,
    state: { kind: 'error', message: `${fileTitle(path || 'This row')} can't be opened.`, reason, details },
    refusal: undefined,
    upgraded: false,
    library: EMPTY_LIBRARY,
    text: () => '',
    settled: () => Promise.resolve(),
    quietly: (change) => change(),
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
  if (read === undefined) return failed(options, path, others, 'There is no such file.')
  const outcome = readLevel(encoder.encode(read.text))
  if (outcome.status === 'invalid') {
    // A format with a major version above this editor's is a file from a newer version; anything else is the file's own
    // writing.
    const newer = (afFormatVersion(formatOf(outcome.text))?.major ?? 0) > 2
    return failed(options, path, others, newer ? NEWER : UNREADABLE, outcome.issues)
  }
  if (outcome.status !== 'parsed') return failed(options, path, others, UNREADABLE)

  // The game's own furniture and materials, read once on open; a game that has none (or a workspace that cannot list)
  // gives the empty library, and the room is read on its own.
  const library = await readGameLibrary(path, ports.workspace).catch(() => EMPTY_LIBRARY)
  const profile: LevelProfile<unknown> =
    outcome.profile === afSectorProfile ? afSectorProfileFor(library) : outcome.profile
  const editor = createLevelEditor({ profile, level: outcome.value, now: options.now })
  /** The text the file holds (as far as this session knows) and the level it parses to: what the next patch is from. */
  // A file from an older version starts from its upgrade: nothing is written until a step, and the first step writes the
  // upgrade with it, as one write and one Undo (the suite's Undo puts back the bytes it replaced, the older text).
  let base = { text: outcome.text, model: outcome.value }
  let mtime = read.mtime
  let quiet = false
  let queue: Promise<void> = Promise.resolve()

  const session = {
    path,
    others,
    options,
    state: { kind: 'open', editor } as const,
    refusal: undefined as string | undefined,
    upgraded: outcome.upgraded,
    library,
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
  }

  const refuse = (why: string): void => {
    session.refusal = why
    session.quietly(() => editor.history.undo())
  }

  // A drag or a draw shows its work live inside one open step, and the step's revision moves only when it ends. The file
  // follows the steps, not the frames between them: one step is one write, and so one Undo of the suite.
  let seen = editor.history.revision
  editor.history.subscribe(() => {
    if (editor.history.revision === seen) return
    seen = editor.history.revision
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
