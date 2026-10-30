// An open level and the facility beside it (ED3D spec §4.2, §5.3 flows 1 and 6, §8): what `EditorApp.open` hands the
// views. A level is a `LevelEditor` and its patched document, with the checks run once on open; a Last Light level may
// also belong to a facility file, which opens as an editor and a document of its own (ED3D.9a decision 1), so undo,
// the dirty mark and the autosave stay per file.
import {
  classifyStorageError,
  findRecovery,
  type ProjectStore,
  type Recovery,
  readStored,
  type StorageClock,
  statPath,
  type Workspace,
} from '@mcthaydt/automata-editor-kit/core'
import type { CheckResult } from '../checks/check'
import type { Facility } from '../format/facility.schema'
import { createFacilityEditor, type FacilityEditor, type FacilityState } from '../model/facility-editor'
import { createLevelEditor, type LevelEditor } from '../model/level-editor'
import type { LevelState } from '../model/level-state'
import type { ParseIssue } from '../profile/file-codec'
import { facilityCodec } from '../profile/last-light-codecs'
import type { LevelProfile } from '../profile/level-profile'
import { createPatchedDocument, type PatchedDocument } from './patched-document'
import { decodeText } from './read-level'

export interface OpenLevel {
  readonly path: string
  readonly profile: LevelProfile<unknown>
  readonly editor: LevelEditor<unknown>
  readonly document: PatchedDocument
  /** The checks, run once as the level opened (spec §5.3 flow 1); the checks panel runs them after each step. */
  readonly checks: readonly CheckResult[]
  /** What the file opened with: a newer minor version. */
  readonly warnings: readonly ParseIssue[]
}

export interface OpenFacility {
  readonly path: string
  readonly editor: FacilityEditor
  readonly document: PatchedDocument
  readonly recovery: Recovery | undefined
  readonly recoveryError?: string | undefined
}

/** What became of the facility a Last Light level looked for: World is shown when it opened, hidden with the reason otherwise. */
export type FacilityOutcome =
  | { readonly status: 'opened'; readonly facility: OpenFacility }
  | { readonly status: 'missing' }
  | { readonly status: 'invalid'; readonly path: string; readonly issues: readonly ParseIssue[] }
  | { readonly status: 'unreadable'; readonly path: string; readonly message: string }

/** The autosave to offer for `path`; a journal that cannot be read is reported, and the document opens anyway. */
export async function recoveryFor(
  workspace: Workspace,
  path: string,
): Promise<{ recovery: Recovery | undefined; recoveryError?: string }> {
  try {
    return { recovery: await findRecovery(workspace.store, workspace.journal, path) }
  } catch (error) {
    return { recovery: undefined, recoveryError: classifyStorageError(error).message }
  }
}

export interface OpenLevelOptions {
  readonly workspace: Workspace
  readonly clock: StorageClock
  readonly path: string
  readonly mtime: number
  readonly profile: LevelProfile<unknown>
  readonly level: unknown
  readonly text: string
  readonly warnings: readonly ParseIssue[]
}

export function openLevel(options: OpenLevelOptions): OpenLevel {
  const { profile, level, clock } = options
  const editor = createLevelEditor({ profile, level, now: clock.now })
  const levelDocument = createPatchedDocument<LevelState<unknown>, unknown>({
    workspace: options.workspace,
    clock,
    path: options.path,
    mtime: options.mtime,
    text: options.text,
    model: level,
    codec: profile,
    history: editor.history,
    modelOf: (state) => state.level,
    withModel: (model) => ({ level: model }),
  })
  return {
    path: options.path,
    profile,
    editor,
    document: levelDocument,
    checks: profile.checks(level),
    warnings: options.warnings,
  }
}

export const FACILITY_FILE = 'facility.json'

const folderOf = (path: string): string => path.slice(0, Math.max(0, path.lastIndexOf('/')))
const inFolder = (folder: string, name: string): string => (folder === '' ? name : `${folder}/${name}`)

/**
 * The facility file of a level at `levelPath`: `facility.json` in the level's folder, else in a folder beside it (the
 * Last Light layout: `docs/art/blockout-facility/` beside `docs/art/blockout-clinic/`), the first by path. Folders at the
 * top of the workspace are import roots, so they are never searched as siblings.
 */
export async function findFacilityBeside(
  store: ProjectStore,
  levelPath: string,
): Promise<string | undefined> {
  const folder = folderOf(levelPath)
  const own = inFolder(folder, FACILITY_FILE)
  if ((await statPath(store, own)) !== undefined) return own
  const parent = folderOf(folder)
  // A level one folder deep sits at the top of an import root: the folders beside it are other imports, not its game.
  if (parent === '') return undefined
  const prefix = `${parent}/`
  const sibling = (await store.list(prefix)).find((entry) => {
    const rest = entry.path.slice(prefix.length).split('/')
    return rest.length === 2 && rest[1] === FACILITY_FILE
  })
  return sibling?.path
}

/** Looks for the facility beside a level and opens it when there is one. */
export async function openFacilityBeside(
  workspace: Workspace,
  clock: StorageClock,
  levelPath: string,
): Promise<FacilityOutcome> {
  let path: string | undefined
  try {
    path = await findFacilityBeside(workspace.store, levelPath)
  } catch (error) {
    return {
      status: 'unreadable',
      path: inFolder(folderOf(levelPath), FACILITY_FILE),
      message: classifyStorageError(error).message,
    }
  }
  if (path === undefined) return { status: 'missing' }
  const stored = await readStored(workspace.store, path)
  if (stored.status === 'missing') return { status: 'missing' }
  if (stored.status === 'storageFailed') return { status: 'unreadable', path, message: stored.message }
  const decoded = decodeText(stored.bytes)
  if (decoded.status === 'notText') return { status: 'unreadable', path, message: 'The file is not text.' }
  if (decoded.status === 'tooLarge') return { status: 'unreadable', path, message: 'The file is over 16 MB.' }
  const parsed = facilityCodec.parse(decoded.text)
  if (!parsed.ok) return { status: 'invalid', path, issues: parsed.issues }
  const editor = createFacilityEditor({ facility: parsed.value, now: clock.now })
  const facilityDocument = createPatchedDocument<FacilityState, Facility>({
    workspace,
    clock,
    path,
    mtime: stored.mtime,
    text: decoded.text,
    model: parsed.value,
    codec: facilityCodec,
    history: editor.history,
    modelOf: (state) => state.facility,
    withModel: (facility) => ({ facility }),
  })
  const recovery = await recoveryFor(workspace, path)
  return { status: 'opened', facility: { path, editor, document: facilityDocument, ...recovery } }
}
