import { createHistory } from '../../../shared/kit/history/history.ts'
import type { WorkspaceFile } from '../../../shared/kit/ports/suite-ports.ts'
import { readDocument } from '../../../shared/level-2d/documents/read-document'
import { projectHistory } from '../../../shared/level-2d/model/edit-history'
import { createAppProfiles } from '../../level-2d/profiles'

// What Home's Characters card lists. The card is a view of the level file, so it reads that file for the names of the
// game's characters instead of opening the editor.

const encoder = new TextEncoder()

/** The names a view of the level files has, in the words the editor shows: the characters for `characters`, none otherwise. */
export async function levels2dHomeNames(
  view: string,
  files: readonly WorkspaceFile[],
  read: (path: string) => Promise<string | undefined>,
): Promise<readonly string[]> {
  if (view !== 'characters') return []
  const names: string[] = []
  for (const file of files) {
    const text = await read(file.path)
    if (text === undefined) continue
    const outcome = readDocument(
      createAppProfiles(),
      file.path.split('/').pop() ?? file.path,
      encoder.encode(text),
    )
    if (outcome.status !== 'parsed') continue
    const project = projectHistory(createHistory<unknown>(outcome.value))?.state
    names.push(...(project?.defs.entities.map((entity) => entity.label ?? entity.id) ?? []))
  }
  return names
}
