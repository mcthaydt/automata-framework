// What the game has and has not, found once when the editor opens: whether its code uses the systems extension, and
// whether its editor list names the files Schematic edits. A game without either gets a sentence saying what to add,
// never a quiet fallback.
import { EDITOR_LIST_PATH, loadEditorList, workspaceFile } from '@automata/editor/editor-list'
import type { SuitePorts } from '@automata/editor/kit/ports'
import type { SchematicFacts } from './schematic-session.svelte.ts'

/** The rows an editor list needs, to copy: one for each place Schematic writes. */
export const LIST_ROWS = `[[file]]
glob = "content/systems/*.toml"
editor = "schematic"
modes = ["edit", "ask"]
gates = []
checks = ["content"]

[[file]]
glob = "content/nav/*.toml"
editor = "schematic"
modes = ["edit", "ask"]
gates = []
checks = ["content"]

[[file]]
glob = "content/puzzles/*.toml"
editor = "schematic"
modes = ["edit", "ask"]
gates = []
checks = ["content"]
`

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

async function listed(ports: SuitePorts): Promise<{ systems: boolean; nav: boolean; twoD: boolean }> {
  const file = await ports.workspace.read(EDITOR_LIST_PATH)
  if (file === undefined) return { systems: true, nav: true, twoD: false }
  const load = loadEditorList(file.text)
  if (!load.ok) return { systems: true, nav: true, twoD: false }
  const writes = (path: string): boolean => {
    const row = workspaceFile(load.list, path)
    return row.editor === 'schematic' && row.writable
  }
  const editors = new Set(load.list.file.map((row) => row.editor))
  return {
    systems: writes('content/systems/scene.toml'),
    nav: writes('content/nav/scene.toml'),
    twoD: editors.has('levels-2d') && !editors.has('levels-3d'),
  }
}

export async function findFacts(ports: SuitePorts, gameUrl: string | undefined): Promise<SchematicFacts> {
  const rows = await listed(ports)
  return {
    usesSystems: await usesSystems(ports),
    listsSystems: rows.systems,
    listsNav: rows.nav,
    twoD: rows.twoD,
    gameUrl,
  }
}
