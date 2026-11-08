// The commands and keys of the level editor (ED3D.3 step 8): undo and redo, delete and duplicate over the selected
// sectors, and the view modes, registered in the kit's registry and reached through its keymap. They run on the toy
// level (a hall and a dock that lead into each other, 8 and 6 m wide) so every case can be read off its numbers.

import type { AfSector2File } from '@automata/3d/level'
import {
  type CommandRegistry,
  createCommandRegistry,
  createKeymap,
  type KeyInput,
  type Keymap,
} from '@automata/editor/kit/core'
import { beforeEach, describe, expect, it } from 'vitest'
import { registerEditCommands } from '#src/shared/edit/edit-commands.ts'
import { createLevelEditor, type LevelEditor } from '#src/shared/edit/level-editor.ts'
import { setLight } from '#src/shared/edit/sector-edits.ts'
import { afSectorProfile } from '#src/shared/level-session/af-sector-profile.ts'
import type { EditSector } from '#src/shared/level-session/sector-access.ts'
import { rect } from '#src/testing/edit-helpers.ts'
import { toyAfSector } from '#src/testing/toy-af-sector.ts'

interface Rig {
  editor: LevelEditor<AfSector2File>
  registry: CommandRegistry
  keymap: Keymap
  refusals: string[]
  unregister: () => void
}

function rig(level: AfSector2File = toyAfSector()): Rig {
  const editor = createLevelEditor({ profile: afSectorProfile, level })
  const registry = createCommandRegistry()
  const refusals: string[] = []
  const unregister = registerEditCommands(editor, registry, { onRefusal: (reason) => refusals.push(reason) })
  return { editor, registry, keymap: createKeymap(registry, 'other'), refusals, unregister }
}

const press = (key: string, held: Partial<KeyInput> = {}): KeyInput => ({
  key,
  metaKey: false,
  ctrlKey: false,
  shiftKey: false,
  altKey: false,
  inText: false,
  ...held,
})

const sectorsOf = (editor: LevelEditor<AfSector2File>): readonly EditSector[] =>
  afSectorProfile.sectors.list(editor.level)
const idsOf = (editor: LevelEditor<AfSector2File>): string[] => sectorsOf(editor).map((sector) => sector.id)
const sector = (editor: LevelEditor<AfSector2File>, id: string): EditSector => {
  const found = sectorsOf(editor).find((each) => each.id === id)
  if (found === undefined) throw new Error(`no sector ${id}`)
  return found
}
const extra = (id: string, x0: number, z0: number, x1: number, z1: number) => ({
  id,
  floor: 0,
  ceiling: 4,
  light: 1,
  corners: rect(x0, z0, x1, z1),
})
const lightOf = (editor: LevelEditor<AfSector2File>, id: string): number => sector(editor, id).light

describe('registerEditCommands', () => {
  let r: Rig
  beforeEach(() => {
    r = rig()
  })

  it('registers the edit and view commands with their keys, in this order', () => {
    expect(r.registry.list().map((command) => [command.id, command.shortcut])).toEqual([
      ['edit.undo', 'Mod+Z'],
      ['edit.redo', 'Mod+Shift+Z'],
      ['edit.delete', 'Delete'],
      ['edit.duplicate', 'Mod+D'],
      ['view.plan', '1'],
      ['view.split', '2'],
      ['view.dollhouse', '3'],
      ['view.toggle', 'Tab'],
    ])
    expect(r.registry.list().map((command) => command.title)).toEqual([
      'Undo',
      'Redo',
      'Delete',
      'Duplicate',
      'Plan view',
      'Split view',
      'Dollhouse view',
      'Switch between plan and 3D',
    ])
  })

  it('takes every command out again with the function it returns, and can be registered anew', () => {
    r.unregister()
    expect(r.registry.list()).toEqual([])
    expect(() => registerEditCommands(r.editor, r.registry)).not.toThrow()
    expect(r.registry.list()).toHaveLength(8)
  })

  it('refuses a registry that has one of the ids already, and leaves it as it was', () => {
    expect(() => registerEditCommands(r.editor, r.registry)).toThrow(
      'command "edit.undo" is already registered',
    )
    expect(r.registry.list()).toHaveLength(8)
  })

  it('puts the registry back when a command in the middle does not fit, by its id or by its key', () => {
    const early = createCommandRegistry()
    const own = { id: 'view.toggle', title: 'Mine', run: () => {} }
    early.register(own)
    expect(() => registerEditCommands(r.editor, early)).toThrow('command "view.toggle" is already registered')
    expect(early.list()).toEqual([own])
    const keyed = createCommandRegistry()
    const tab = { id: 'mine.tab', title: 'Mine', shortcut: 'Tab', run: () => {} }
    keyed.register(tab)
    expect(() => registerEditCommands(r.editor, keyed)).toThrow('cannot use Tab: "mine.tab" already does')
    expect(keyed.list()).toEqual([tab])
  })
})

describe('edit.undo and edit.redo', () => {
  it('are disabled until there is something to undo or to redo, so their keys fall through', () => {
    const r = rig()
    expect(r.registry.get('edit.undo')?.enabled?.()).toBe(false)
    expect(r.registry.get('edit.redo')?.enabled?.()).toBe(false)
    expect(r.registry.run('edit.undo')).toBe(false)
    expect(r.keymap.resolve(press('z', { ctrlKey: true }))).toBeUndefined()
    r.editor.run(setLight({ id: 'hall', light: 0.5 }))
    expect(r.registry.get('edit.undo')?.enabled?.()).toBe(true)
    expect(r.registry.get('edit.redo')?.enabled?.()).toBe(false)
  })

  it('undo and redo through their keys, and not while typing', () => {
    const r = rig()
    r.editor.run(setLight({ id: 'hall', light: 0.5 }))
    expect(r.keymap.handle(press('z', { ctrlKey: true, inText: true }))).toBe(false)
    expect(lightOf(r.editor, 'hall')).toBe(0.5)
    expect(r.keymap.handle(press('z', { ctrlKey: true }))).toBe(true)
    expect(lightOf(r.editor, 'hall')).toBe(1)
    expect(r.registry.get('edit.redo')?.enabled?.()).toBe(true)
    expect(r.keymap.handle(press('z', { ctrlKey: true, shiftKey: true }))).toBe(true)
    expect(lightOf(r.editor, 'hall')).toBe(0.5)
  })

  it('answer to Cmd on an Apple keyboard', () => {
    const r = rig()
    const apple = createKeymap(r.registry, 'apple')
    r.editor.run(setLight({ id: 'hall', light: 0.5 }))
    expect(apple.handle(press('z', { metaKey: true }))).toBe(true)
    expect(lightOf(r.editor, 'hall')).toBe(1)
  })
})

describe('edit.delete', () => {
  it('is disabled with no sector selected, and a wall or an entity selected is not one', () => {
    const r = rig()
    const del = r.registry.get('edit.delete')
    expect(del?.enabled?.()).toBe(false)
    r.editor.selection.set(['wall:hall/1', 'entity:crate/crate1'])
    expect(del?.enabled?.()).toBe(false)
    expect(r.keymap.resolve(press('Delete'))).toBeUndefined()
    r.editor.selection.set(['wall:hall/1', 'sector:dock'])
    expect(del?.enabled?.()).toBe(true)
    expect(r.keymap.resolve(press('Delete'))?.id).toBe('edit.delete')
  })

  it('does not count a sector the level no longer has', () => {
    const r = rig()
    r.editor.selection.set(['sector:ghost'])
    expect(r.registry.get('edit.delete')?.enabled?.()).toBe(false)
    expect(r.registry.get('edit.duplicate')?.enabled?.()).toBe(false)
  })

  it('removes the sectors of a mixed selection and leaves the walls and entities it holds alone', () => {
    const r = rig(toyAfSector({ sectors: [...toyAfSector().sectors, extra('yard', 14, 0, 18, 6)] }))
    r.editor.selection.set(['wall:hall/1', 'sector:yard', 'entity:crate/crate1'])
    r.registry.run('edit.delete')
    expect(idsOf(r.editor)).toEqual(['hall', 'dock'])
    expect(r.refusals).toEqual([])
  })

  it('removes the selected sectors as one step, joined ones included, and undo brings them back', () => {
    const level = toyAfSector({
      sectors: [
        ...toyAfSector().sectors,
        { id: 'yard', floor: 0, ceiling: 4, light: 1, corners: rect(14, 0, 18, 6) },
      ],
    })
    const r = rig(level)
    r.editor.selection.set(['sector:hall', 'sector:dock'])
    const before = r.editor.history.revision
    expect(r.keymap.handle(press('Delete'))).toBe(true)
    expect(idsOf(r.editor)).toEqual(['yard'])
    expect(r.editor.history.revision).toBe(before + 1)
    expect(r.editor.history.undoLabel).toBe('Remove 2 sectors')
    expect(r.editor.selection.ids).toEqual([])
    r.editor.history.undo()
    expect(idsOf(r.editor)).toEqual(['hall', 'dock', 'yard'])
    expect(r.refusals).toEqual([])
  })

  it('removes nothing when one of them cannot go, and says why', () => {
    const r = rig()
    r.editor.selection.set(['sector:hall'])
    const before = r.editor.history.revision
    r.registry.run('edit.delete')
    expect(idsOf(r.editor)).toEqual(['hall', 'dock'])
    expect(r.editor.history.revision).toBe(before)
    expect(r.refusals).toEqual(['sector hall is still referenced: sector dock corner 3: a portal into hall'])
    expect(r.editor.selection.ids).toEqual(['sector:hall'])
  })

  it('does nothing when run with nothing selected, as a button that was not greyed might', () => {
    const r = rig()
    const before = r.editor.history.revision
    r.registry.get('edit.delete')?.run()
    expect(r.editor.history.revision).toBe(before)
    expect(r.refusals).toEqual([])
  })

  it('says nothing about a refusal when it is not asked to', () => {
    const editor = createLevelEditor({ profile: afSectorProfile, level: toyAfSector() })
    const registry = createCommandRegistry()
    registerEditCommands(editor, registry)
    editor.selection.set(['sector:hall'])
    expect(() => registry.run('edit.delete')).not.toThrow()
    expect(idsOf(editor)).toEqual(['hall', 'dock'])
  })

  it('is refused while a drag is open, with the reason', () => {
    const r = rig()
    r.editor.selection.set(['sector:hall', 'sector:dock'])
    const drag = r.editor.begin('Drag')
    r.registry.run('edit.delete')
    expect(idsOf(r.editor)).toEqual(['hall', 'dock'])
    expect(r.refusals).toHaveLength(1)
    expect(r.refusals[0]).toContain('Drag')
    drag.cancel()
  })
})

describe('edit.duplicate', () => {
  it('is disabled with no sector selected', () => {
    const r = rig()
    expect(r.registry.get('edit.duplicate')?.enabled?.()).toBe(false)
    r.editor.selection.set(['wall:hall/1'])
    expect(r.registry.get('edit.duplicate')?.enabled?.()).toBe(false)
    expect(r.keymap.resolve(press('d', { ctrlKey: true }))).toBeUndefined()
  })

  it('refuses, when run with nothing selected, and does not make up a size', () => {
    const r = rig()
    const before = r.editor.history.revision
    r.registry.get('edit.duplicate')?.run()
    expect(r.refusals).toEqual(['no sector is selected'])
    expect(r.editor.history.revision).toBe(before)
  })

  it('copies a sector to its right, one grid step clear of it, selects the copy and is one step', () => {
    const r = rig()
    r.editor.selection.set(['sector:dock'])
    const before = r.editor.history.revision
    expect(r.keymap.handle(press('d', { ctrlKey: true }))).toBe(true)
    expect(idsOf(r.editor)).toEqual(['hall', 'dock', 'dock2'])
    expect(sector(r.editor, 'dock2').corners).toEqual([
      [14.5, 0],
      [20.5, 0],
      [20.5, 6],
      [14.5, 6],
    ])
    expect(r.editor.selection.ids).toEqual(['sector:dock2'])
    expect(r.editor.history.revision).toBe(before + 1)
    expect(r.editor.history.undoLabel).toBe('Duplicate sector dock')
    r.editor.history.undo()
    expect(idsOf(r.editor)).toEqual(['hall', 'dock'])
    expect(r.refusals).toEqual([])
  })

  it('goes below, then to the left, then above, when the sector beside it is taken', () => {
    const r = rig()
    // The hall's right side is the dock: the copy goes below it, one grid step clear.
    r.editor.selection.set(['sector:hall'])
    r.registry.run('edit.duplicate')
    expect(sector(r.editor, 'hall2').corners[0]).toEqual([0, 6.5])
    // Now the hall has the dock to its right and its copy below: the copy goes to its left.
    r.editor.selection.set(['sector:hall'])
    r.registry.run('edit.duplicate')
    expect(sector(r.editor, 'hall3').corners[0]).toEqual([-8.5, 0])
    // And with all three sides taken, above.
    r.editor.selection.set(['sector:hall'])
    r.registry.run('edit.duplicate')
    expect(sector(r.editor, 'hall4').corners[0]).toEqual([0, -6.5])
    expect(r.refusals).toEqual([])
  })

  it('copies several sectors together, in their own arrangement, as one step', () => {
    const r = rig()
    r.editor.selection.set(['sector:hall', 'sector:dock'])
    const before = r.editor.history.revision
    r.registry.run('edit.duplicate')
    expect(idsOf(r.editor)).toEqual(['hall', 'dock', 'hall2', 'dock2'])
    // The pair is 14 m wide: both copies move 14.5 m to the right and keep their places beside each other.
    expect(sector(r.editor, 'hall2').corners[0]).toEqual([14.5, 0])
    expect(sector(r.editor, 'dock2').corners[0]).toEqual([22.5, 0])
    expect(r.editor.selection.ids).toEqual(['sector:hall2', 'sector:dock2'])
    expect(r.editor.history.revision).toBe(before + 1)
    expect(r.editor.history.undoLabel).toBe('Duplicate 2 sectors')
  })

  it('measures the step by the grid of the view', () => {
    const r = rig()
    r.editor.view.set({ grid: { step: 2, snap: true } })
    r.editor.selection.set(['sector:dock'])
    r.registry.run('edit.duplicate')
    expect(sector(r.editor, 'dock2').corners[0]).toEqual([16, 0])
  })

  it('copies nothing when no side is free, and gives the reason for the first', () => {
    // A room with a room on each side that is as big as the room itself, so no side is free for a copy.
    const level = toyAfSector({
      sectors: [
        extra('mid', 0, 0, 4, 4),
        extra('east', 4, 0, 12, 4),
        extra('south', 0, 4, 4, 12),
        extra('west', -8, 0, 0, 4),
        extra('north', 0, -8, 4, 0),
      ],
    })
    const r = rig(level)
    r.editor.selection.set(['sector:mid'])
    const before = r.editor.history.revision
    r.registry.run('edit.duplicate')
    expect(idsOf(r.editor)).toEqual(['mid', 'east', 'south', 'west', 'north'])
    expect(r.editor.history.revision).toBe(before)
    expect(r.editor.selection.ids).toEqual(['sector:mid'])
    expect(r.refusals).toEqual(['the new sector overlaps east'])
  })

  it('measures a sector that does not stand at the origin from its own edges', () => {
    const r = rig(toyAfSector({ sectors: [extra('a', 0, 2, 4, 8), extra('b', 4, 2, 8, 8)] }))
    r.editor.selection.set(['sector:a'])
    r.registry.run('edit.duplicate')
    // The right is taken by b, so the copy goes below: 6 m high and a grid step clear, from z = 8.
    expect(sector(r.editor, 'a2').corners[0]).toEqual([0, 8.5])
  })

  it('takes back the copies it made on a side where a later one did not fit, and keeps the selection', () => {
    // Two rooms selected, and on every side a room that the second copy would land on after the first fits.
    const level = toyAfSector({
      sectors: [
        extra('a', 0, 0, 4, 4),
        extra('b', 10, 0, 14, 4),
        extra('east', 24.5, 0, 28.5, 4),
        extra('south', 10, 4.5, 14, 8.5),
        extra('west', -4.5, 0, -0.5, 4),
        extra('north', 10, -4.5, 14, -0.5),
      ],
    })
    const r = rig(level)
    r.editor.selection.set(['sector:a', 'sector:b'])
    const before = r.editor.history.revision
    r.registry.run('edit.duplicate')
    expect(idsOf(r.editor)).toEqual(['a', 'b', 'east', 'south', 'west', 'north'])
    expect(r.editor.history.revision).toBe(before)
    expect(r.editor.selection.ids).toEqual(['sector:a', 'sector:b'])
    expect(r.refusals).toEqual(['the new sector overlaps east'])
  })

  it('is refused while a drag is open, with the reason', () => {
    const r = rig()
    r.editor.selection.set(['sector:dock'])
    const drag = r.editor.begin('Drag')
    r.registry.run('edit.duplicate')
    expect(idsOf(r.editor)).toEqual(['hall', 'dock'])
    expect(r.refusals[0]).toContain('Drag')
    drag.cancel()
  })
})

describe('the view commands', () => {
  it('set the mode through their keys and leave the history alone', () => {
    const r = rig()
    const before = r.editor.history.revision
    r.keymap.handle(press('2'))
    expect(r.editor.view.state.mode).toBe('split')
    r.keymap.handle(press('3'))
    expect(r.editor.view.state.mode).toBe('dollhouse')
    r.keymap.handle(press('1'))
    expect(r.editor.view.state.mode).toBe('plan')
    expect(r.editor.history.revision).toBe(before)
    expect(r.editor.history.canUndo).toBe(false)
  })

  it('switch between the plan and the 3D view with Tab, and go to the plan from any other', () => {
    const r = rig()
    r.keymap.handle(press('Tab'))
    expect(r.editor.view.state.mode).toBe('dollhouse')
    r.keymap.handle(press('Tab'))
    expect(r.editor.view.state.mode).toBe('plan')
    r.editor.view.set({ mode: 'split' })
    r.keymap.handle(press('Tab'))
    expect(r.editor.view.state.mode).toBe('plan')
    r.editor.view.set({ mode: 'walk' })
    r.keymap.handle(press('Tab'))
    expect(r.editor.view.state.mode).toBe('plan')
  })

  it('are enabled whatever the view is, and leave typing alone', () => {
    const r = rig()
    for (const command of r.registry.list().filter((each) => each.id.startsWith('view.')))
      expect(command.enabled?.() ?? true).toBe(true)
    expect(r.keymap.handle(press('2', { inText: true }))).toBe(false)
    expect(r.editor.view.state.mode).toBe('plan')
  })
})
