// Which files the suite may write, from the game's editor list (editor suite spec §4.2, §11). Modelled on The Last
// Light's editor/src/server/policy.ts `canWrite` (92e6704), in its order: outside the root, then never, then
// generated, then the first editable row. The Node workspace (EDS.1d) puts every write through this; it is pure, so
// the browser shows the same reasons before anything is sent.

import { EDITOR_LIST_PATH, type EditorList, type FileRow } from './editors.schema'
import { globMatch } from './glob'

/**
 * Never written, whatever the list says: the list itself (the suite cannot widen its own allowlist, and an Ask diff
 * cannot add a command to a check's `run`), git's internals and gate records (an editor never records a gate). Each
 * declared gate's `records` glob joins these.
 */
export const ALWAYS_NEVER: readonly string[] = [EDITOR_LIST_PATH, '.git/**', '**/gates.json']

export type FileAccess =
  | { readonly writable: true; readonly path: string; readonly row: FileRow; readonly scene?: string }
  | {
      readonly writable: false
      readonly path: string
      /** `outside`: not a path in the game root; `unlisted`: no row matches. */
      readonly reason: 'outside' | 'never' | 'generated' | 'unlisted'
      /** A sentence for the person, naming the glob that decided it. */
      readonly why: string
    }

/** A root-relative POSIX path: not empty or absolute, and no empty, `.` or `..` segment and no backslash. */
function insideRoot(path: string): boolean {
  if (path === '' || path.startsWith('/') || path.includes('\\')) return false
  return path.split('/').every((segment) => segment !== '' && segment !== '.' && segment !== '..')
}

const readOnly = (
  path: string,
  reason: 'outside' | 'never' | 'generated' | 'unlisted',
  why: string,
): FileAccess => ({
  writable: false,
  path,
  reason,
  why,
})

/** Whether the suite may write `path` (root-relative), and through which row; read only with the reason otherwise. */
export function fileAccess(list: EditorList, path: string): FileAccess {
  if (!insideRoot(path)) return readOnly(path, 'outside', `${path} is not a path inside the game root`)
  const never = [...ALWAYS_NEVER, ...list.gate.map((gate) => gate.records), ...list.never].find(
    (glob) => globMatch(glob, path) !== undefined,
  )
  if (never !== undefined) return readOnly(path, 'never', `never written by an editor (${never})`)
  const generated = list.generated.find((glob) => globMatch(glob, path) !== undefined)
  if (generated !== undefined) {
    return readOnly(path, 'generated', `generated (${generated}); change its source instead`)
  }
  for (const row of list.file) {
    const match = globMatch(row.glob, path)
    if (match === undefined) continue
    return match.scene === undefined
      ? { writable: true, path, row }
      : { writable: true, path, row, scene: match.scene }
  }
  return readOnly(path, 'unlisted', `no row of ${EDITOR_LIST_PATH} lists it`)
}
