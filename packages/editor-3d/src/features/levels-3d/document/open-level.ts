// An open level (ED3D spec §4.2, §5.3 flow 1, §8): what `EditorApp.open` hands the views. A level is a `LevelEditor` and
// its patched document, with the checks run once on open.
import {
  classifyStorageError,
  findRecovery,
  type Recovery,
  type StorageClock,
  type Workspace,
} from '@automata/editor/kit/core'
import type { CheckResult } from '../../../shared/checks/check'
import { createLevelEditor, type LevelEditor } from '../../../shared/edit/level-editor'
import type { LevelState } from '../../../shared/edit/level-state'
import type { ParseIssue } from '../../../shared/level-session/file-codec'
import type { LevelProfile } from '../../../shared/level-session/level-profile'
import { createPatchedDocument, type PatchedDocument } from './patched-document'

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
