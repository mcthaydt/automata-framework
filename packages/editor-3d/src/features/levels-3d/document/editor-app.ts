// The 3D editor's session over a workspace (ED3D spec §5.3 flow 1, §8; kit spec §4.7 and §5): opening a level with
// the profile the registry picks and keeping it saved, the facility beside a Last Light level, the project list Home
// shows, and importing a folder or a zip. Plain TypeScript with no Svelte, so the views of ED3D.5c and the tests use
// the same object. Time is the caller's: `app/` reads no clock of its own.
import {
  type Recovery,
  readStored,
  type StorageClock,
  type StorageFailure,
  type Workspace,
} from '@automata/editor/kit/core'
import type { ParseIssue } from '../../../shared/level-session/file-codec'
import type { LevelProfile } from '../../../shared/level-session/level-profile'
import { type CreateOutcome, createLevel } from '../home/new-level'
import { listProjects, type ProjectEntry } from '../home/project-list'
import { type ImportOutcome, importFolder, importZip, type PickedFile } from './import-files'
import { type OpenLevel, openLevel, recoveryFor } from './open-level'
import { installedProfiles, readLevel } from './read-level'

export type OpenOutcome =
  | {
      readonly status: 'opened'
      readonly level: OpenLevel
      /** An autosave newer than the file, for the recovery dialog to offer. */
      readonly recovery: Recovery | undefined
      /** Set when the autosave could not be read: the level opened anyway. */
      readonly recoveryError?: string | undefined
    }
  | {
      readonly status: 'unrecognised'
      readonly path: string
      readonly reason: string
      readonly installed: readonly string[]
      readonly message: string
      readonly text: string
    }
  | {
      readonly status: 'invalid'
      readonly path: string
      readonly profile: LevelProfile<unknown>
      readonly issues: readonly ParseIssue[]
      readonly installed: readonly string[]
      readonly text: string
    }
  | { readonly status: 'notText' | 'missing'; readonly path: string }
  | { readonly status: 'tooLarge'; readonly path: string; readonly bytes: number }
  | {
      readonly status: 'storageFailed'
      readonly path: string
      readonly reason: StorageFailure
      readonly message: string
    }

export interface EditorApp {
  readonly workspace: Workspace
  /** The ids of the profiles this editor opens. */
  readonly installed: readonly string[]
  /** The projects Home shows, newest first. Rejects with the kit's `StorageError` when the workspace cannot be listed. */
  list(): Promise<readonly ProjectEntry[]>
  open(path: string): Promise<OpenOutcome>
  /** A picked folder's files, each path starting with the folder's name. */
  importFolder(files: readonly PickedFile[]): Promise<ImportOutcome>
  /** A zip's bytes; `name` is the zip's file name. */
  importZip(name: string, bytes: Uint8Array): Promise<ImportOutcome>
  /** A new level from a name (ED3D.13b): its folder and file are written, and its path comes back to open. */
  create(name: string): Promise<CreateOutcome>
}

export interface EditorAppOptions {
  readonly workspace: Workspace
  /** Time for the autosave debounce, the store's mtimes in tests and the history's coalescing. */
  readonly clock: StorageClock
}

export function createEditorApp(options: EditorAppOptions): EditorApp {
  const { workspace, clock } = options

  async function open(path: string): Promise<OpenOutcome> {
    const stored = await readStored(workspace.store, path)
    if (stored.status !== 'read') return { ...stored, path }
    const read = readLevel(stored.bytes)
    if (read.status !== 'parsed') return { ...read, path }
    const recovery = await recoveryFor(workspace, path)
    const level = openLevel({
      workspace,
      clock,
      path,
      mtime: stored.mtime,
      profile: read.profile,
      level: read.value,
      text: read.text,
      warnings: read.warnings,
    })
    return { status: 'opened', level, ...recovery }
  }

  return {
    workspace,
    installed: installedProfiles(),
    list: () => listProjects(workspace.store),
    open,
    importFolder: (files) => importFolder(workspace.store, files),
    importZip: (name, bytes) => importZip(workspace.store, name, bytes),
    create: (name) => createLevel(workspace.store, name),
  }
}
