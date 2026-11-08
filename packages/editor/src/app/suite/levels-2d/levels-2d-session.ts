import type { Component } from 'svelte'
import { createLevelSession, type LevelSession } from '../../../features/level/level-session'
import { createHistory, type History } from '../../../shared/kit/history/history.ts'
import type { SuiteUndo } from '../../../shared/kit/ports/suite-editor.ts'
import type { SuitePorts, WorkspaceFile } from '../../../shared/kit/ports/suite-ports.ts'
import type { ProjectStore, WriteExpectation } from '../../../shared/kit/storage/project-store.ts'
import { readDocument } from '../../../shared/level-2d/documents/read-document'
import type { LevelCanvasProps, ObjectUrls } from '../../../shared/level-2d/documents/view-props'
import type { IdSource } from '../../../shared/level-2d/model/ids'
import type { ParseError, Profile } from '../../../shared/level-2d/profiles/profile'
import { createAppProfiles } from '../../editor-2d/profiles'

// The Levels 2D session: what the suite keeps for the 2D level
// editor while the person is elsewhere. It holds the document's kit history and the Level view's session (the level,
// layer, tool, selection and camera), so a switch and return finds them as they were. Every new step is written through
// the suite's workspace, whose write path records it for the top bar's Undo; the session's own undo and redo only move
// the history back, because that write path has already put the file back. A file that cannot be opened is a state.

export interface Levels2dOptions {
  /** Where the ids of placed instances come from. */
  readonly ids: IdSource
  /**
   * Reads a workspace file's bytes for the canvas and the palette (tileset images). By default the workspace's own
   * `readBytes`; a workspace of text only reads nothing and the tiles show numbered.
   */
  readonly read?: ((path: string) => Promise<Uint8Array | undefined>) | undefined
  /** Makes URLs for the tile pictures the panels show; absent (jsdom), they show numbered. */
  readonly objectUrls?: ObjectUrls | undefined
  /** The level canvas; the Pixi `LevelCanvas` when absent (jsdom tests pass a stand-in). */
  readonly canvas?: Component<LevelCanvasProps> | undefined
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
  readonly options: Levels2dOptions
  /** The other files of the row group, which this session does not open (one file per open, plan decision 2). */
  readonly others: readonly string[]
  /** Reads a picture's bytes (options' reader, else the workspace's). */
  read(path: string): Promise<Uint8Array | undefined>
  /** Where Add tiles writes its picture; absent when the workspace cannot write one. */
  readonly files: Pick<ProjectStore, 'list' | 'write'> | undefined
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

/** The pictures side of a session: its reader and, where the workspace can write one, the store Add tiles uses. */
function picturesOf(options: Levels2dOptions, ports: SuitePorts) {
  const readBytes = ports.workspace.readBytes?.bind(ports.workspace)
  const read = options.read ?? readBytes ?? (() => Promise.resolve(undefined))
  const { writeBytes } = ports.workspace
  const files: Pick<ProjectStore, 'list' | 'write'> | undefined =
    writeBytes === undefined
      ? undefined
      : {
          list: async (prefix = '') =>
            (await ports.workspace.files())
              .filter((each) => each.path.startsWith(prefix))
              .map((each) => ({ path: each.path, size: 0, mtime: 0 })),
          write: (path, data, expected) =>
            typeof data === 'string'
              ? ports.workspace.write(path, data, expected ?? 'absent')
              : writeBytes.call(ports.workspace, path, data, expected ?? 'absent'),
        }
  return { read, files }
}

function failed(
  ports: SuitePorts,
  options: Levels2dOptions,
  path: string,
  others: readonly string[],
  message: string,
  errors: readonly ParseError[] = [],
) {
  const session: Levels2dSession = {
    path,
    options,
    others,
    ...picturesOf(options, ports),
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
    return failed(
      ports,
      options,
      path,
      others,
      `${path || 'This row'} can’t be opened: there is no such file.`,
    )
  const name = path.split('/').pop() ?? path
  const outcome = readDocument(createAppProfiles(), name, encoder.encode(read.text))
  if (outcome.status !== 'parsed') {
    const errors = outcome.status === 'invalid' ? outcome.errors : []
    return failed(ports, options, path, others, `${name} can’t be opened as a level project.`, errors)
  }

  const { profile } = outcome
  const history = createHistory<unknown>(outcome.value)
  const level = createLevelSession({ history, ids: options.ids })
  if (level === undefined)
    return failed(ports, options, path, others, `${name} can’t be opened: it has no level to draw.`)

  const base = read.text
  let mtime = read.mtime
  // A game that exports has its files written with the project, as one step, so the game reads what was drawn. Each is
  // expected as it was found (or absent); once written here, the write path itself watches it.
  const folder = files.find((each) => each.path === path)?.exports
  const target = profile.exports.find((each) => each.id === profile.gameTarget)
  const gameFiles = (value: unknown, text: string) =>
    folder === undefined || target === undefined || ports.workspace.writeAll === undefined
      ? []
      : target.files(value, text).map((file) => ({ path: `${folder}/${file.path}`, text: file.contents }))
  const expectations = new Map<string, WriteExpectation>()
  for (const file of gameFiles(history.state, base)) {
    const found = await ports.workspace.read(file.path).catch(() => undefined)
    expectations.set(file.path, found === undefined ? 'absent' : { mtime: found.mtime })
  }
  let quiet = false
  let queue: Promise<void> = Promise.resolve()
  const session = {
    path,
    options,
    others,
    ...picturesOf(options, ports),
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
    const value = history.state
    queue = queue.then(async () => {
      const exported = gameFiles(value, base)
      const result =
        exported.length === 0 || ports.workspace.writeAll === undefined
          ? await ports.workspace.write(path, text, { mtime })
          : await ports.workspace.writeAll([
              ...exported.map((file) => {
                const expected = expectations.get(file.path)
                return expected === undefined ? file : { ...file, expected }
              }),
              { path, text, expected: { mtime } },
            ])
      if (result.ok) {
        mtime = result.mtime
        for (const file of exported) expectations.delete(file.path)
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
