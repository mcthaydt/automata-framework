// Which files the suite may write, from the game's editor list. The rules run in
// this order: outside the root, then never, then
// generated, then the first editable row. The Node workspace puts every write through this; it is pure, so
// the browser shows the same reasons before anything is sent.

import type { UnlistedFile, WorkspaceFile } from '../kit/ports/suite-ports.ts'
import { EDITOR_LIST_PATH, type EditorList, type FileRow } from './editors.schema'
import { globMatch } from './glob'

/**
 * Never written, whatever the list says: the list itself (the suite cannot widen its own allowlist, and an Ask diff
 * cannot add a command to a check's `run`), git's internals and gate records (an editor never records a gate), and
 * what is always refused besides: agent and
 * CI configuration and env files. Each declared gate's `records` glob joins these. They match in any letter case, as a
 * case-insensitive disk (macOS, Windows) would open `Content/Editors.toml` as the list.
 *
 * This is a check of the path as written. The disk adapter must resolve the real path of the target first
 * (symlinks, and Windows' trailing dots and spaces, which name the same file) and check that, inside the game root.
 */
export const ALWAYS_NEVER: readonly string[] = [
  EDITOR_LIST_PATH,
  '.git',
  '.git/**',
  '**/gates.json',
  '.claude/**',
  '.github/**',
  '**/.env',
  '**/.env.*',
]

export type FileAccess =
  | { readonly writable: true; readonly path: string; readonly row: FileRow; readonly scene?: string }
  | {
      readonly writable: false
      readonly path: string
      /** `outside`: not a path in the game root; `unlisted`: no row matches. */
      readonly reason: 'outside' | 'never' | 'generated' | 'unlisted'
      /** A sentence for the person, naming the glob that decided it. */
      readonly why: string
      /** For a never or generated path, the first row whose glob also matches: the editor that shows it, read only. */
      readonly row?: FileRow
      readonly scene?: string
    }

/** A root-relative POSIX path: not empty or absolute, and no empty, `.` or `..` segment and no backslash. */
function insideRoot(path: string): boolean {
  if (path === '' || path.startsWith('/') || path.includes('\\')) return false
  return path.split('/').every((segment) => segment !== '' && segment !== '.' && segment !== '..')
}

/** The game files a level project writes into its `exports` folder: the project, the world and one file per level. */
export function exportPathsMatch(exports: string, path: string): boolean {
  if (!path.startsWith(`${exports}/`)) return false
  const rest = path.slice(exports.length + 1)
  if (rest === 'project.toml' || rest === 'world.toml') return true
  return rest.startsWith('levels/') && rest.endsWith('.toml') && !rest.slice('levels/'.length).includes('/')
}

/** The first row whose glob matches `path`, with the scene its `{scene}` matched. */
function firstRow(list: EditorList, path: string): { row: FileRow; scene?: string } | undefined {
  for (const row of list.file) {
    const match = globMatch(row.glob, path)
    if (match === undefined) continue
    return match.scene === undefined ? { row } : { row, scene: match.scene }
  }
  // No row lists the file: it may still be a game file some level project exports.
  const exporter = list.file.find((row) => row.exports !== undefined && exportPathsMatch(row.exports, path))
  return exporter === undefined ? undefined : { row: exporter }
}

const readOnly = (
  path: string,
  reason: 'outside' | 'never' | 'generated' | 'unlisted',
  why: string,
  matched?: { row: FileRow; scene?: string },
): FileAccess => ({ writable: false, path, reason, why, ...matched })

/** Whether the suite may write `path` (root-relative), and through which row; read only with the reason otherwise. */
export function fileAccess(list: EditorList, path: string): FileAccess {
  if (!insideRoot(path)) return readOnly(path, 'outside', `${path} is not a path inside the game root`)
  const never =
    [...ALWAYS_NEVER, ...list.gate.map((gate) => gate.records)].find(
      (glob) => globMatch(glob, path, { ignoreCase: true }) !== undefined,
    ) ?? list.never.find((glob) => globMatch(glob, path) !== undefined)
  const matched = firstRow(list, path)
  if (never !== undefined) return readOnly(path, 'never', `never written by an editor (${never})`, matched)
  const generated = list.generated.find((glob) => globMatch(glob, path) !== undefined)
  if (generated !== undefined) {
    return readOnly(path, 'generated', `generated (${generated}); change its source instead`, matched)
  }
  if (matched !== undefined) return { writable: true, path, ...matched }
  return readOnly(path, 'unlisted', `no row of ${EDITOR_LIST_PATH} lists it`)
}

/**
 * The workspace port's view of `path`: the row's editor, scene,
 * gates, checks and modes, and whether the suite may write it. A path no row matches (or outside the root) has no
 * editor, only the reason. The memory workspace and the disk adapter both class paths through this.
 */
export function workspaceFile(list: EditorList, path: string): WorkspaceFile | UnlistedFile {
  const access = fileAccess(list, path)
  const { row } = access
  if (row === undefined) return { path, writable: false, why: access.writable ? '' : access.why }
  return {
    path,
    editor: row.editor,
    ...(access.scene === undefined ? {} : { scene: access.scene }),
    gates: row.gates,
    checks: row.checks,
    modes: row.modes,
    writable: access.writable,
    ...(access.writable ? {} : { why: access.why }),
  }
}
