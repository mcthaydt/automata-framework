import type { Component } from 'svelte'
import { type Writable, writable } from 'svelte/store'
import { createEntitiesSession, type EntitiesSession } from '../../../features/characters/entities-session'
import { createLevelSession, type LevelSession } from '../../../features/level/level-session'
import { createTilesetsSession, type TilesetsSession } from '../../../features/tiles/tilesets-session'
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

export type Levels2dView = 'level' | 'tiles' | 'characters'

export type Levels2dState =
  | {
      readonly kind: 'open'
      readonly profile: Profile<unknown>
      readonly history: History<unknown>
      readonly level: LevelSession
      /** The Tiles view's session, made with the document so a switch and return finds its selection. */
      readonly tiles: TilesetsSession
      /** The Characters view's session, made with the document so a switch and return finds its selection. */
      readonly characters: EntitiesSession
    }
  | { readonly kind: 'error'; readonly message: string; readonly errors: readonly ParseError[] }

export interface Levels2dSession {
  readonly path: string
  readonly options: Levels2dOptions
  /** The other files of the row group, which this session does not open (one file per open, plan decision 2). */
  readonly others: readonly string[]
  /** `refusal` as a store, for the status line, which must follow a write that finishes after its step. */
  readonly refused: Writable<string | undefined>
  /** True while the project changed somewhere else and the person has not yet chosen between the two versions. */
  readonly conflict: Writable<boolean>
  /** Use mine: writes the open project and the game's files over the other version. */
  keepMine(): Promise<void>
  /** Use theirs: takes the other version in, dropping the step that conflicted. */
  takeTheirs(): Promise<void>
  /** Which view fills the shell: the level, the game's tiles or its characters. */
  readonly view: Writable<Levels2dView>
  /** Whether Add tiles' dialog is open; the Tiles panel and its stage both open it. */
  readonly adding: Writable<boolean>
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
    view: writable<Levels2dView>('level'),
    adding: writable(false),
    conflict: writable(false),
    refused: writable<string | undefined>(undefined),
    keepMine: () => Promise.resolve(),
    takeTheirs: () => Promise.resolve(),
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
  const tiles = createTilesetsSession({ history, ids: options.ids })
  const characters = createEntitiesSession({ history, ids: options.ids })
  if (level === undefined || tiles === undefined || characters === undefined)
    return failed(ports, options, path, others, `${name} can’t be opened: it has no level to draw.`)

  let base = read.text
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
  /** The next write is the person's choice to go over a version made somewhere else (Use mine, Use theirs). */
  let force = false
  const conflict = writable(false)
  const refused = writable<string | undefined>(undefined)
  const session = {
    path,
    options,
    others,
    ...picturesOf(options, ports),
    view: writable<Levels2dView>('level'),
    adding: writable(false),
    conflict,
    refused,
    state: { kind: 'open', profile, history, level, tiles, characters } as const,
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
    keepMine() {
      force = true
      queue = queue.then(() => saveSafely(history.state))
      return queue
    },
    async takeTheirs() {
      await queue
      const found = await ports.workspace.read(path).catch(() => undefined)
      const theirs = found === undefined ? undefined : profile.parse(found.text)
      if (found === undefined || theirs === undefined || !theirs.ok) {
        refuse('The other version can’t be opened, so yours stays.')
        return
      }
      base = found.text
      mtime = found.mtime
      force = true
      history.apply('Use theirs', () => theirs.value)
      await queue
    },
  }

  function refuse(message: string | undefined): void {
    session.refusal = message
    refused.set(message)
  }

  /** Writes `value`'s game files and then its project, with the versions this session last saw. */
  async function save(value: unknown): Promise<void> {
    const text = profile.print(base, value)
    const exported = gameFiles(value, base)
    const forced = force
    force = false
    const result =
      ports.workspace.writeAll === undefined
        ? await ports.workspace.write(path, text, { mtime })
        : await ports.workspace.writeAll([
            ...exported.map((file) => {
              const expected = expectations.get(file.path)
              return forced ? { ...file, force: true } : expected === undefined ? file : { ...file, expected }
            }),
            { path, text, expected: { mtime }, ...(forced ? { force: true } : {}) },
          ])
    if (result.ok) {
      mtime = result.mtime
      for (const file of exported) expectations.delete(file.path)
      refuse(undefined)
      conflict.set(false)
      return
    }
    refuse(result.message)
    // Another version is there: the step stays, and the person chooses (Use mine, Use theirs).
    if (result.reason === 'conflict') conflict.set(true)
    else session.quietly(() => history.undo())
  }

  // Writes run one at a time, each with the text its step left; a refused one takes that step back quietly. A write that
  // throws (the server failed to answer) is shown as a refusal and the queue goes on, so the next step still saves.
  const saveSafely = (value: unknown): Promise<void> =>
    save(value).catch((error: unknown) => {
      refuse(`Your last change was not saved: ${error instanceof Error ? error.message : String(error)}`)
    })
  history.subscribe(() => {
    if (quiet) return
    const value = history.state
    queue = queue.then(() => saveSafely(value))
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
