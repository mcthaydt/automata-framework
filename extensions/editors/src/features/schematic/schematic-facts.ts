// What the game has and has not, found once when the editor opens: whether its code has the part that plays what
// Schematic makes, and what kind of game it is. A game without it is told so (NoPlayer), never given a quiet fallback.
// The editor list is not asked: starting a file adds Schematic's rows to it (`ports.list.ensure`).
import { EDITOR_LIST_PATH, loadEditorList } from '@automata/editor/editor-list'
import type { SuitePorts } from '@automata/editor/kit/ports'
import { gameHasPlayer } from '../../shared/game-player.ts'
import type { SchematicFacts } from './schematic-session.svelte.ts'

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
  return { hasPlayer: await gameHasPlayer(ports.workspace, 'schematic'), twoD: await isTwoD(ports), gameUrl }
}
