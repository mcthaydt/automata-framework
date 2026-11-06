// The commands a key or a button can run on the level editor (ED3D spec §5.4 and the keys of §6, ED3D.3 step 8): undo
// and redo, delete and duplicate over the selected sectors, and the view modes. They are kit `Command`s that close over
// the editor, so the toolbar, the menu and the keymap all reach the same thing. A command that has nothing to do is
// disabled, so its key falls through to the browser. The edits themselves take arguments and live in the `*-edits`
// files; these only turn the selection into those arguments.
import { type CommandRegistry, defineCommand } from '@mcthaydt/automata-editor/kit/core'
import { type EditResult, ok, refuse } from './edit'
import type { LevelEditor } from './level-editor'
import { duplicateSector, removeSectors } from './sector-edits'
import { parseSelection } from './selection-ref'

export interface EditCommandOptions {
  /** Told why a delete or a duplicate did nothing: a command has no way to answer, and a silent key is a broken key. */
  readonly onRefusal?: ((reason: string) => void) | undefined
}

/** The selected sectors that the level has, in selection order; a wall, an entity or a stale id is not one. */
function selectedSectors<D>(editor: LevelEditor<D>): string[] {
  const present = new Set(editor.profile.sectors.list(editor.level).map((sector) => sector.id))
  return editor.selection.ids.flatMap((id) => {
    const ref = parseSelection(id)
    return ref?.kind === 'sector' && present.has(ref.sector) ? [ref.sector] : []
  })
}

/** Removes the selected sectors as one step, or none of them when one cannot go. */
function deleteSelected<D>(editor: LevelEditor<D>): EditResult<D> {
  return editor.run(removeSectors({ ids: selectedSectors(editor) }))
}

/** Right of the sector, then below, to the left and above: where a copy is tried, in this order. */
const SIDES: readonly (readonly [number, number])[] = [
  [1, 0],
  [0, 1],
  [-1, 0],
  [0, -1],
]

/**
 * Copies the selected sectors, together and in their own arrangement, to the first side of them that is free: moved
 * by their width (or height) and one grid step, so the copies stand clear of what they were copied from. All of them
 * go in as one step, and the copies become the selection. When no side is free nothing changes, the selection stays
 * and the answer is why the first side (the right) was refused.
 */
function duplicateSelected<D>(editor: LevelEditor<D>): EditResult<D> {
  const ids = selectedSectors(editor)
  if (ids.length === 0) return refuse('no sector is selected')
  const chosen = editor.profile.sectors.list(editor.level).filter((sector) => ids.includes(sector.id))
  const xs = chosen.flatMap((sector) => sector.corners.map((corner) => corner[0]))
  const zs = chosen.flatMap((sector) => sector.corners.map((corner) => corner[1]))
  const step = editor.view.state.grid.step
  const across = Math.max(...xs) - Math.min(...xs) + step
  const down = Math.max(...zs) - Math.min(...zs) + step
  const label = ids.length === 1 ? `Duplicate sector ${ids[0]}` : `Duplicate ${ids.length} sectors`
  const selected = editor.selection.ids
  let firstRefusal: EditResult<D> | undefined
  for (const [right, below] of SIDES) {
    const session = editor.begin(label)
    const copies: string[] = []
    let refusal: EditResult<D> | undefined
    for (const id of ids) {
      const result = session.run(duplicateSector({ id, offset: { x: right * across, z: below * down } }))
      if (!result.ok) {
        refusal = result
        break
      }
      copies.push(...(result.select ?? []))
    }
    if (refusal === undefined) {
      session.commit()
      editor.selection.set(copies)
      return ok(editor.level, copies)
    }
    // A run that went in selected its copy, and the ones before this refusal are cancelled with the session.
    session.cancel()
    editor.selection.set(selected)
    firstRefusal ??= refusal
  }
  return firstRefusal as EditResult<D>
}

/**
 * Registers the editor's commands in `registry` and answers the function that takes them all out again. The registry
 * refuses a second registration of the same ids, so a shell registers once per editor.
 */
export function registerEditCommands<D>(
  editor: LevelEditor<D>,
  registry: CommandRegistry,
  options: EditCommandOptions = {},
): () => void {
  const report = (result: EditResult<D>): void => {
    if (!result.ok) options.onRefusal?.(result.reason)
  }
  const { history, view } = editor
  const hasSector = (): boolean => selectedSectors(editor).length > 0
  const commands = [
    defineCommand({
      id: 'edit.undo',
      title: 'Undo',
      shortcut: 'Mod+Z',
      enabled: () => history.canUndo,
      run: () => history.undo(),
    }),
    defineCommand({
      id: 'edit.redo',
      title: 'Redo',
      shortcut: 'Mod+Shift+Z',
      enabled: () => history.canRedo,
      run: () => history.redo(),
    }),
    defineCommand({
      id: 'edit.delete',
      title: 'Delete',
      shortcut: 'Delete',
      enabled: hasSector,
      run: () => report(deleteSelected(editor)),
    }),
    defineCommand({
      id: 'edit.duplicate',
      title: 'Duplicate',
      shortcut: 'Mod+D',
      enabled: hasSector,
      run: () => report(duplicateSelected(editor)),
    }),
    defineCommand({
      id: 'view.plan',
      title: 'Plan view',
      shortcut: '1',
      run: () => view.set({ mode: 'plan' }),
    }),
    defineCommand({
      id: 'view.split',
      title: 'Split view',
      shortcut: '2',
      run: () => view.set({ mode: 'split' }),
    }),
    defineCommand({
      id: 'view.dollhouse',
      title: 'Dollhouse view',
      shortcut: '3',
      run: () => view.set({ mode: 'dollhouse' }),
    }),
    defineCommand({
      id: 'view.toggle',
      title: 'Switch between plan and 3D',
      shortcut: 'Tab',
      run: () => view.set({ mode: view.state.mode === 'plan' ? 'dollhouse' : 'plan' }),
    }),
  ]
  const removers: (() => void)[] = []
  try {
    for (const command of commands) removers.push(registry.register(command))
  } catch (error) {
    // A command that is already there leaves the registry as it was.
    for (const remove of removers) remove()
    throw error
  }
  return () => {
    for (const remove of removers) remove()
  }
}
