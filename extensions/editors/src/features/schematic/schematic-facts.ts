// What the game has and has not, found once when the editor opens: whether its code uses the systems extension, and
// what kind of game it is. A game without the extension gets a sentence saying what to add, never a quiet fallback.
// The editor list is not asked: starting a file adds Schematic's rows to it (`ports.list.ensure`).
import { EDITOR_LIST_PATH, loadEditorList } from '@automata/editor/editor-list'
import type { SuitePorts } from '@automata/editor/kit/ports'
import type { SchematicFacts } from './schematic-session.svelte.ts'

async function usesSystems(ports: SuitePorts): Promise<boolean> {
  const manifest = await ports.workspace.read('package.json')
  if (manifest === undefined) return true
  try {
    const json = JSON.parse(manifest.text) as Record<string, Record<string, unknown> | undefined>
    return ['dependencies', 'devDependencies', 'peerDependencies'].some(
      (field) => json[field] !== undefined && '@automata/systems' in (json[field] as object),
    )
  } catch {
    return true
  }
}

/** The list names a 2D level editor and no 3D one, so light and warmth need the game's own facts. */
async function isTwoD(ports: SuitePorts): Promise<boolean> {
  const file = await ports.workspace.read(EDITOR_LIST_PATH)
  if (file === undefined) return false
  const load = loadEditorList(file.text)
  if (!load.ok) return false
  const editors = new Set(load.list.file.map((row) => row.editor))
  return editors.has('levels-2d') && !editors.has('levels-3d')
}

export async function findFacts(ports: SuitePorts, gameUrl: string | undefined): Promise<SchematicFacts> {
  return { usesSystems: await usesSystems(ports), twoD: await isTwoD(ports), gameUrl }
}
