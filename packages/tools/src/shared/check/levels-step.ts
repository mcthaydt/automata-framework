import { join } from 'node:path'
import { EDITOR_LIST_PATH, globMatch, loadEditorList } from '@automata/editor/editor-list'
import { exportContent, openProject } from '@automata/editor/level-export'
import { Effect } from 'effect'
import { Files } from '../node/files.ts'
import type { CheckFinding } from './check-report.ts'
import { CheckToolError } from './csp-probe.ts'

// The `levels` step of `automata check`: a level project and the game files the editor writes from it must agree.
// Save writes both, so they only disagree when someone edited one by hand or Save stopped part-way. For each row of
// the editor list that names `exports`, every matching project is opened, exported, and the bytes compared with the
// files on disk. A game with no editor list, or no such row, has nothing to check.

// The editor has no Save button: each change it makes saves itself, so the way to save again is a change.
const LAST_LINE =
  'Open the level in the editor, change anything, then undo it. The editor saves the game’s files again.'

const finding = (file: string, message: string): CheckFinding => ({
  file,
  line: 0,
  col: 0,
  rule: 'levels',
  message: `${message}\n${LAST_LINE}`,
})

/** The folder a glob starts in: its leading segments up to the first one with a wildcard or a scene. */
const folderOf = (glob: string): string => {
  const fixed: string[] = []
  for (const segment of glob.split('/').slice(0, -1)) {
    if (/[*?{]/.test(segment)) break
    fixed.push(segment)
  }
  return fixed.join('/')
}

/** The drift check, in the shape the other steps have. Its only tool is the file system. */
export const levelsStep = (gameDir: string): Effect.Effect<readonly CheckFinding[], CheckToolError, Files> =>
  Effect.gen(function* () {
    const files = yield* Files
    const toolError = (detail: string) => new CheckToolError({ kind: 'failed', tool: 'levels', detail })
    const read = (path: string) =>
      Effect.mapError(files.readText(join(gameDir, path)), (error) => toolError(error.message))

    if (!(yield* files.exists(join(gameDir, EDITOR_LIST_PATH)))) return []
    const loaded = loadEditorList(yield* read(EDITOR_LIST_PATH))
    // A list that does not load is the editor's problem to show; this step cannot tell which projects it names.
    if (!loaded.ok) return []

    const findings: CheckFinding[] = []
    for (const row of loaded.list.file) {
      if (row.exports === undefined) continue
      const folder = folderOf(row.glob)
      const base = join(gameDir, folder)
      if (!(yield* files.exists(base))) continue
      const listed = yield* Effect.mapError(files.listFiles(base), (error) => toolError(error.message))
      for (const name of listed) {
        const path = folder === '' ? name : `${folder}/${name}`
        if (globMatch(row.glob, path) === undefined) continue
        const opened = openProject(yield* read(path))
        if (opened.status !== 'opened') {
          const first = opened.status === 'failed' ? opened.issues?.[0] : undefined
          const detail = first === undefined ? '' : ` First problem: ${first.path}: ${first.message}.`
          findings.push(finding(path, `${path}: ${opened.message}${detail}`))
          continue
        }
        for (const exported of exportContent(opened.project)) {
          const target = `${row.exports}/${exported.path}`
          const onDisk = (yield* files.exists(join(gameDir, target))) ? yield* read(target) : undefined
          if (onDisk !== exported.contents)
            findings.push(finding(target, `${target} does not match ${path}.`))
        }
      }
    }
    return findings
  })
