import type { Component } from 'svelte'
import { get, type Readable, type Writable, writable } from 'svelte/store'
import { type TemplateCard, templateCards } from '../../../features/home/home-model'
import { createLevelSession, type LevelSession } from '../../../features/level/level-session'
import {
  levelFile,
  type ShareAction,
  type ShareOutcome,
  shareLevel,
} from '../../../features/share/share-model'
import { createTilesetsSession, type TilesetsSession } from '../../../features/tiles/tilesets-session'
import { loadEditorList } from '../../../shared/editor-list/editor-list'
import { EDITOR_LIST_PATH } from '../../../shared/editor-list/editors.schema'
import { newFilePath, workspaceFile } from '../../../shared/editor-list/workspace-policy'
import { createHistory, type History } from '../../../shared/kit/history/history.ts'
import type { SuiteUndo } from '../../../shared/kit/ports/suite-editor.ts'
import type { SuitePorts, WorkspaceFile } from '../../../shared/kit/ports/suite-ports.ts'
import type { DownloadStore } from '../../../shared/kit/storage/download-store.ts'
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
// A group with no level is a state too: on the sample game it offers the templates, and the level one makes opens in
// this same session (the suite opens one session per editor for its life), so its state is a store.

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
  /**
   * A group with no level offers the templates to start one from. Only the sample game (the site's try-it) does: a
   * game folder keeps its own levels, and its editors have only what editing a game needs (the Owner, 2026-11-06).
   */
  readonly templates?: boolean | undefined
  /**
   * Where Share sends the level: only where nothing keeps it (the sample game, held in the page). Absent, there is no
   * Share, because a game folder saves every step.
   */
  readonly exports?: DownloadStore | undefined
}

export type Levels2dView = 'level' | 'tiles'

export type Levels2dState =
  | {
      readonly kind: 'open'
      readonly profile: Profile<unknown>
      readonly history: History<unknown>
      readonly level: LevelSession
      /** The Tiles view's session, made with the document so a switch and return finds its selection. */
      readonly tiles: TilesetsSession
    }
  | { readonly kind: 'error'; readonly message: string; readonly errors: readonly ParseError[] }
  | {
      readonly kind: 'empty'
      /** What a new level can start from; none on a game folder. */
      readonly templates: readonly TemplateCard[]
      /** A level is being made. */
      readonly busy: boolean
      /** Why the last one could not be made. */
      readonly problem?: string | undefined
    }

export interface Levels2dSession {
  /** The open level's path; `''` while the group has none. */
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
  /** Which view fills the shell: the level, or the game's tiles. */
  readonly view: Writable<Levels2dView>
  /** Whether Add tiles' dialog is open; the Tiles panel and its stage both open it. */
  readonly adding: Writable<boolean>
  /** Reads a picture's bytes (options' reader, else the workspace's). */
  read(path: string): Promise<Uint8Array | undefined>
  /** Where Add tiles writes its picture; absent when the workspace cannot write one. */
  readonly files: Pick<ProjectStore, 'list' | 'write'> | undefined
  /** `state` as a store: a level made from a template turns `empty` into `open`. */
  readonly current: Readable<Levels2dState>
  /** The state now. */
  readonly state: Levels2dState
  /** Why the last write was refused (that step was taken back); `undefined` after a write that went through. */
  readonly refusal: string | undefined
  /** Resolves once every write started so far has finished. */
  settled(): Promise<void>
  /** Runs `change` without writing what it does to the history (the suite's Undo and Redo). */
  quietly(change: () => void): void
  /** Makes a level from a template, writes it into the game and opens it here; a refusal stays on the templates. */
  create(profileId: string, templateId: string): Promise<void>
  /** Whether Share is offered (options' `exports`). */
  readonly canShare: boolean
  /** Hands the open level over as it stands; `undefined` with no level open or nowhere to send it. */
  share(action: ShareAction): Promise<ShareOutcome | undefined>
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

/** One open file's writing: its queue of saves, its conflict choices and the text it was read with. */
interface Opened {
  readonly base: () => string
  settled(): Promise<void>
  quietly(change: () => void): void
  keepMine(): Promise<void>
  takeTheirs(): Promise<void>
}

/** Where a new level goes: the folder the game's list keeps Levels 2D's level projects in, or `undefined`. */
async function placeNew(ports: SuitePorts, name: string) {
  const loaded = loadEditorList((await ports.workspace.read(EDITOR_LIST_PATH))?.text)
  if (!loaded.ok) return undefined
  const levels = { ...loaded.list, file: loaded.list.file.filter((row) => row.editor === 'levels-2d') }
  const path = newFilePath(levels, name)
  const placed = path === undefined ? undefined : workspaceFile(loaded.list, path)
  return placed === undefined || !('editor' in placed) || placed.editor !== 'levels-2d' ? undefined : placed
}

export async function openLevels2d(
  files: readonly WorkspaceFile[],
  ports: SuitePorts,
  options: Levels2dOptions,
): Promise<Levels2dSession> {
  const registry = createAppProfiles()
  const first = chosen(files)
  const others = files.map((file) => file.path).filter((each) => each !== first)
  const conflict = writable(false)
  const refused = writable<string | undefined>(undefined)
  const templates = options.templates === true ? templateCards(registry) : []
  const current = writable<Levels2dState>({ kind: 'empty', templates, busy: false })
  let path = first
  let refusal: string | undefined
  let opened: Opened | undefined

  function refuse(message: string | undefined): void {
    refusal = message
    refused.set(message)
  }

  /** Opens `text` as the session's level, read from `path` at `mtime`; a file that does not open is a state. */
  async function attach(text: string, mtime: number, folder: string | undefined): Promise<Levels2dState> {
    const name = path.split('/').pop() ?? path
    const outcome = readDocument(registry, name, encoder.encode(text))
    if (outcome.status !== 'parsed') {
      const errors = outcome.status === 'invalid' ? outcome.errors : []
      return { kind: 'error', message: `${name} can’t be opened as a level project.`, errors }
    }
    const { profile } = outcome
    const history = createHistory<unknown>(outcome.value)
    const level = createLevelSession({ history, ids: options.ids })
    const tiles = createTilesetsSession({ history, ids: options.ids })
    if (level === undefined || tiles === undefined)
      return { kind: 'error', message: `${name} can’t be opened: it has no level to draw.`, errors: [] }
    opened = await writer(profile, history, text, mtime, folder)
    return { kind: 'open', profile, history, level, tiles }
  }

  /** Saves every new step of `history` to `path`, with the game's files where the game exports into `folder`. */
  async function writer(
    profile: Profile<unknown>,
    history: History<unknown>,
    text: string,
    found: number,
    folder: string | undefined,
  ): Promise<Opened> {
    const file = path
    let base = text
    let mtime = found
    // A game that exports has its files written with the project, as one step, so the game reads what was drawn. Each
    // is expected as it was found (or absent); once written here, the write path itself watches it.
    const target = profile.exports.find((each) => each.id === profile.gameTarget)
    const gameFiles = (value: unknown, text: string) =>
      folder === undefined || target === undefined || ports.workspace.writeAll === undefined
        ? []
        : target.files(value, text).map((each) => ({ path: `${folder}/${each.path}`, text: each.contents }))
    const expectations = new Map<string, WriteExpectation>()
    for (const each of gameFiles(history.state, base)) {
      const there = await ports.workspace.read(each.path).catch(() => undefined)
      expectations.set(each.path, there === undefined ? 'absent' : { mtime: there.mtime })
    }
    let quiet = false
    let queue: Promise<void> = Promise.resolve()
    /** The next write is the person's choice to go over a version made somewhere else (Use mine, Use theirs). */
    let force = false

    /** Writes `value`'s game files and then its project, with the versions this session last saw. */
    async function save(value: unknown): Promise<void> {
      const printed = profile.print(base, value)
      const exported = gameFiles(value, base)
      const forced = force
      force = false
      const result =
        ports.workspace.writeAll === undefined
          ? await ports.workspace.write(file, printed, { mtime })
          : await ports.workspace.writeAll([
              ...exported.map((each) => {
                const expected = expectations.get(each.path)
                return forced
                  ? { ...each, force: true }
                  : expected === undefined
                    ? each
                    : { ...each, expected }
              }),
              { path: file, text: printed, expected: { mtime }, ...(forced ? { force: true } : {}) },
            ])
      if (result.ok) {
        mtime = result.mtime
        for (const each of exported) expectations.delete(each.path)
        refuse(undefined)
        conflict.set(false)
        return
      }
      refuse(result.message)
      // Another version is there: the step stays, and the person chooses (Use mine, Use theirs).
      if (result.reason === 'conflict') conflict.set(true)
      else writing.quietly(() => history.undo())
    }

    const writing: Opened = {
      base: () => base,
      settled: () => queue,
      quietly(change) {
        quiet = true
        try {
          change()
        } finally {
          quiet = false
        }
      },
      keepMine() {
        force = true
        queue = queue.then(() => save(history.state))
        return queue
      },
      async takeTheirs() {
        await queue
        const there = await ports.workspace.read(file).catch(() => undefined)
        const theirs = there === undefined ? undefined : profile.parse(there.text)
        if (there === undefined || theirs === undefined || !theirs.ok) {
          refuse('The other version can’t be opened, so yours stays.')
          return
        }
        base = there.text
        mtime = there.mtime
        force = true
        history.apply('Use theirs', () => theirs.value)
        await queue
      },
    }
    // Writes run one at a time, each with the text its step left; a refused one takes that step back quietly.
    history.subscribe(() => {
      if (quiet) return
      const value = history.state
      queue = queue.then(() => save(value))
    })
    return writing
  }

  async function create(profileId: string, templateId: string): Promise<void> {
    const state = get(current)
    if (state.kind !== 'empty' || state.busy) return
    const stay = (problem: string) => current.set({ ...state, busy: false, problem })
    const profile = registry.get(profileId)
    const template = profile?.templates.find((each) => each.id === templateId)
    // A new document has no loaded text, so its `base` is empty.
    const made =
      template === undefined ? undefined : profile?.exports[0]?.files(template.create(options.ids), '')[0]
    if (made === undefined) return stay('That starting point is not in this editor.')
    current.set({ ...state, busy: true, problem: undefined })
    const placed = await placeNew(ports, made.path)
    if (placed === undefined)
      return stay(
        `Your game has no folder for new levels yet. Add one to ${EDITOR_LIST_PATH}, then try again.`,
      )
    const written = await ports.workspace.write(placed.path, made.contents, 'absent')
    if (!written.ok) return stay(`Your level wasn’t made: ${written.message}`)
    path = placed.path
    current.set(await attach(made.contents, written.mtime, placed.exports))
  }

  const session: Levels2dSession = {
    get path() {
      return path
    },
    options,
    others,
    ...picturesOf(options, ports),
    view: writable<Levels2dView>('level'),
    adding: writable(false),
    conflict,
    refused,
    current,
    get state() {
      return get(current)
    },
    get refusal() {
      return refusal
    },
    settled: () => opened?.settled() ?? Promise.resolve(),
    quietly: (change) => (opened === undefined ? change() : opened.quietly(change)),
    keepMine: () => opened?.keepMine() ?? Promise.resolve(),
    takeTheirs: () => opened?.takeTheirs() ?? Promise.resolve(),
    create,
    canShare: options.exports !== undefined,
    async share(action) {
      const state = get(current)
      const file =
        state.kind === 'open'
          ? levelFile(state.profile, state.history.state, opened?.base() ?? '')
          : undefined
      return file === undefined || options.exports === undefined
        ? undefined
        : shareLevel(action, file, options.exports)
    },
  }

  if (first === '') return session
  const read = await ports.workspace.read(first).catch(() => undefined)
  current.set(
    read === undefined
      ? { kind: 'error', message: `${first} can’t be opened: there is no such file.`, errors: [] }
      : await attach(read.text, read.mtime, files.find((each) => each.path === first)?.exports),
  )
  return session
}

/** The session's history as the suite's top bar sees it; a group with no level open has nothing to undo. */
export function levels2dUndo(session: Levels2dSession): SuiteUndo {
  // The history is read when asked, so a level made from a template is the one the top bar undoes.
  const history = () => {
    const { state } = session
    return state.kind === 'open' ? state.history : undefined
  }
  return {
    canUndo: () => history()?.canUndo ?? false,
    canRedo: () => history()?.canRedo ?? false,
    undoLabel: () => history()?.undoLabel,
    redoLabel: () => history()?.redoLabel,
    undo: () => {
      const open = history()
      if (open !== undefined) session.quietly(() => open.undo())
    },
    redo: () => {
      const open = history()
      if (open !== undefined) session.quietly(() => open.redo())
    },
    // A listener hears the open history's steps, and the level a template makes when it opens.
    subscribe(listener) {
      let detach: (() => void) | undefined
      let attached = false
      const stop = session.current.subscribe((state) => {
        detach?.()
        detach = state.kind === 'open' ? state.history.subscribe(() => listener()) : undefined
        // The store hands over the state it has at once; only a later one is news.
        if (attached) listener()
        attached = true
      })
      return () => {
        detach?.()
        stop()
      }
    },
  }
}
