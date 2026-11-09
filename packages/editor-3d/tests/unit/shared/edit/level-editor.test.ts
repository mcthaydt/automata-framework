// The level editor (ED3D.3 step 4): the kit's History and Selection and the view store behind one object, and the
// protocol every edit goes through. The edits here are small fakes over the depot, so the protocol is tested apart
// from the sector rules (steps 5 to 7).

import type { AfSector2File } from '@automata/3d/level'
import { describe, expect, it, vi } from 'vitest'
import { type Edit, ok, refuse } from '#src/shared/edit/edit.ts'
import { createLevelEditor } from '#src/shared/edit/level-editor.ts'
import { addThing, removeThing } from '#src/shared/edit/thing-edits.ts'
import { afSectorProfile } from '#src/shared/level-session/af-sector-profile.ts'
import type { LevelProfile } from '#src/shared/level-session/level-profile.ts'
import { must } from '#src/testing/edit-helpers.ts'
import { loadAuthored } from '#src/testing/fixtures.ts'

const depot = (() => {
  const result = afSectorProfile.parse(loadAuthored('depot.af-sector'))
  if (!result.ok) throw new Error('the depot does not parse')
  return result.value
})()

/** An edit that sets the hall's light, the way a real edit goes through the profile's sector access. */
function dim(
  light: number,
  more: { coalesce?: string; select?: readonly string[] } = {},
): Edit<AfSector2File> {
  return {
    id: 'test.dim',
    label: `Dim the hall to ${light}`,
    ...(more.coalesce === undefined ? {} : { coalesce: more.coalesce }),
    run(profile: LevelProfile<AfSector2File>, level) {
      const sectors = profile.sectors.list(level)
      const next = profile.sectors.withSectors(
        level,
        sectors.map((sector) => (sector.id === 'hall' ? { ...sector, light } : sector)),
      )
      return ok(next, more.select)
    },
  }
}

/** An edit that removes the dock. */
const dropDock: Edit<AfSector2File> = {
  id: 'test.drop',
  label: 'Drop the dock',
  run: (profile, level) =>
    ok(
      profile.sectors.withSectors(
        level,
        profile.sectors.list(level).filter((sector) => sector.id !== 'dock'),
      ),
    ),
}

const hall = (level: AfSector2File) => must(level.sectors.find((sector) => sector.id === 'hall'))

function editor(now?: () => number) {
  return createLevelEditor({ profile: afSectorProfile, level: depot, ...(now === undefined ? {} : { now }) })
}

describe('a run', () => {
  it("applies an edit as one undo step with the edit's label, and answers its result", () => {
    const e = editor()
    const result = e.run(dim(0.5))
    expect(result).toMatchObject({ ok: true })
    expect(hall(e.level).light).toBe(0.5)
    expect(e.history.revision).toBe(1)
    expect(e.history.undoLabel).toBe('Dim the hall to 0.5')
    e.history.undo()
    expect(e.level).toBe(depot)
  })

  it('records nothing and tells nobody when the edit refuses, and hands the refusal back', () => {
    const e = editor()
    const heard = vi.fn()
    e.history.subscribe(heard)
    const refusal = e.run({
      id: 'test.no',
      label: 'No',
      run: () => refuse('not today', 'sector:hall'),
    })
    expect(refusal).toEqual({ ok: false, reason: 'not today', at: 'sector:hall' })
    expect(e.level).toBe(depot)
    expect(e.history.canUndo).toBe(false)
    expect(heard).not.toHaveBeenCalled()
  })

  it('records nothing for an edit that leaves the level as it was', () => {
    const e = editor()
    const result = e.run({ id: 'test.same', label: 'Same', run: (_profile, level) => ok(level) })
    expect(result).toMatchObject({ ok: true })
    expect(e.history.canUndo).toBe(false)
    expect(e.history.revision).toBe(0)
  })

  it('replaces the selection with what the edit says to select', () => {
    const e = editor()
    e.selection.set(['sector:dock'])
    e.run(dim(0.5, { select: ['sector:hall', 'wall:hall/1'] }))
    expect(e.selection.ids).toEqual(['sector:hall', 'wall:hall/1'])
    expect(e.selection.primary).toBe('wall:hall/1')
  })

  it('leaves the selection alone when the edit says nothing about it', () => {
    const e = editor()
    e.selection.set(['sector:dock'])
    e.run(dim(0.5))
    expect(e.selection.ids).toEqual(['sector:dock'])
  })

  it('joins two runs with one coalesce key inside the window into one step, and not after it', () => {
    let clock = 0
    const e = editor(() => clock)
    e.run(dim(0.5, { coalesce: 'light:hall' }))
    clock = 100
    e.run(dim(0.4, { coalesce: 'light:hall' }))
    expect(e.history.revision).toBe(2)
    e.history.undo()
    expect(e.level).toBe(depot)
    expect(e.history.canUndo).toBe(false)
    e.history.redo()
    clock = 5000
    e.run(dim(0.3, { coalesce: 'light:hall' }))
    e.history.undo()
    expect(hall(e.level).light).toBe(0.4)
  })

  it('keeps two runs with one coalesce key apart when they are further apart than the window', () => {
    let clock = 0
    const e = editor(() => clock)
    e.run(dim(0.5, { coalesce: 'light:hall' }))
    clock = 5000
    e.run(dim(0.4, { coalesce: 'light:hall' }))
    expect(e.history.revision).toBe(2)
    e.history.undo()
    expect(hall(e.level).light).toBe(0.5)
  })
})

describe('the selection follows the document', () => {
  it('drops the sectors and walls an edit removed, and keeps the rest', () => {
    const e = editor()
    e.selection.set(['sector:hall', 'sector:dock', 'wall:dock/2', 'wall:hall/1'])
    e.run(dropDock)
    expect(e.selection.ids).toEqual(['sector:hall', 'wall:hall/1'])
  })

  it('drops them again on undo of an add and on redo of a removal, since the selection is not a step', () => {
    const e = editor()
    e.run(dropDock)
    e.history.undo()
    e.selection.set(['sector:dock', 'wall:dock/0'])
    e.history.redo()
    expect(e.selection.ids).toEqual([])
    e.history.undo()
    expect(e.selection.ids).toEqual([])
  })

  it('drops a wall whose corner is no longer there', () => {
    const e = editor()
    e.selection.set(['wall:hall/3', 'wall:hall/4', 'wall:hall/12'])
    e.run(dim(0.5))
    expect(e.selection.ids).toEqual(['wall:hall/3'])
  })

  it('leaves alone a thing of a kind the level has no definition for, an id it cannot read and an id of a kind it does not know', () => {
    const e = editor()
    e.selection.set(['entity:zone/gone', 'nonsense', 'join:a/b', 'sector:gone'])
    e.run(dim(0.5))
    expect(e.selection.ids).toEqual(['entity:zone/gone', 'nonsense', 'join:a/b'])
  })

  it('drops the things an edit removed, and keeps the things that are there', () => {
    const e = editor()
    e.selection.set(['entity:crate/crate1', 'entity:spawn/spawn', 'entity:crate/ghost', 'sector:hall'])
    e.run(dim(0.5))
    expect(e.selection.ids).toEqual(['entity:crate/crate1', 'entity:spawn/spawn', 'sector:hall'])
    e.run(removeThing({ def: 'crate', id: 'crate1' }))
    expect(e.selection.ids).toEqual(['entity:spawn/spawn', 'sector:hall'])
  })

  it('drops a new thing again on undo of its add and keeps it on redo of nothing, since the selection is not a step', () => {
    const e = editor()
    e.run(addThing({ def: 'crate', id: 'crate2', x: 5, z: 3 }))
    expect(e.selection.ids).toEqual(['entity:crate/crate2'])
    e.history.undo()
    expect(e.selection.ids).toEqual([])
    e.selection.set(['entity:crate/crate2'])
    e.history.redo()
    expect(e.selection.ids).toEqual(['entity:crate/crate2'])
  })

  it('judges a thing of any definition the level defines, and none of a definition it does not', () => {
    const defined: AfSector2File = {
      ...depot,
      entityDefs: [...(depot.entityDefs ?? []), { id: 'switch', shape: 'point', fields: [] }],
    }
    const e = createLevelEditor({ profile: afSectorProfile, level: defined })
    e.selection.set(['entity:switch/ghost', 'entity:zone/ghost'])
    e.run(dim(0.5))
    expect(e.selection.ids).toEqual(['entity:zone/ghost'])
  })

  it('counts a thing that cannot be read as there, because a problem may have selected it', () => {
    const unreadable: AfSector2File = {
      ...depot,
      // It has no x, which the file's schema would refuse and the entity reader reports.
      entities: [...(depot.entities ?? []), { def: 'crate', id: 'bad', z: 1 } as never],
    }
    const e = createLevelEditor({ profile: afSectorProfile, level: unreadable })
    e.selection.set(['entity:crate/bad', 'entity:crate/ghost'])
    e.run(dim(0.5))
    expect(e.selection.ids).toEqual(['entity:crate/bad'])
  })
})

describe('a session (a drag or a draw)', () => {
  it('shows each run live and records nothing until it commits, then one step with its label', () => {
    const e = editor()
    const session = e.begin('Dim the hall')
    expect(session.open).toBe(true)
    session.run(dim(0.8))
    expect(hall(e.level).light).toBe(0.8)
    session.run(dim(0.6))
    expect(hall(e.level).light).toBe(0.6)
    expect(e.history.revision).toBe(0)
    expect(e.history.undoLabel).toBe('Dim the hall')
    session.commit()
    expect(session.open).toBe(false)
    expect(e.history.revision).toBe(1)
    expect(e.history.undoLabel).toBe('Dim the hall')
    e.history.undo()
    expect(e.level).toBe(depot)
    expect(e.history.canUndo).toBe(false)
  })

  it('puts the level back at cancel', () => {
    const e = editor()
    const session = e.begin('Dim the hall')
    session.run(dim(0.8))
    session.cancel()
    expect(e.level).toBe(depot)
    expect(session.open).toBe(false)
    expect(e.history.canUndo).toBe(false)
  })

  it('keeps the live level and stays open when an edit inside it refuses', () => {
    const e = editor()
    const session = e.begin('Dim the hall')
    session.run(dim(0.8))
    const refusal = session.run({ id: 'test.no', label: 'No', run: () => refuse('not today') })
    expect(refusal).toEqual({ ok: false, reason: 'not today' })
    expect(hall(e.level).light).toBe(0.8)
    expect(session.open).toBe(true)
    session.commit()
    expect(e.history.revision).toBe(1)
  })

  it('commits nothing when no run changed the level', () => {
    const e = editor()
    const session = e.begin('Nothing')
    session.run({ id: 'test.same', label: 'Same', run: (_profile, level) => ok(level) })
    session.commit()
    expect(e.history.canUndo).toBe(false)
  })

  it('answers a refusal that names the open edit to a run while a session is open, and to a second begin', () => {
    const e = editor()
    const first = e.begin('Move a corner')
    const refusal = e.run(dim(0.5))
    expect(refusal).toMatchObject({ ok: false })
    expect(refusal.ok ? '' : refusal.reason).toContain('Move a corner')
    const second = e.begin('Another')
    expect(second.open).toBe(false)
    const refused = second.run(dim(0.5))
    expect(refused.ok ? '' : refused.reason).toContain('Move a corner')
    second.commit()
    second.cancel()
    expect(first.open).toBe(true)
    first.run(dim(0.7))
    first.commit()
    expect(hall(e.level).light).toBe(0.7)
  })

  it('is cancelled by an undo, and a run into the cancelled session is refused', () => {
    const e = editor()
    const session = e.begin('Dim the hall')
    session.run(dim(0.8))
    e.history.undo()
    expect(session.open).toBe(false)
    expect(e.level).toBe(depot)
    const refused = session.run(dim(0.4))
    expect(refused.ok).toBe(false)
    expect(e.level).toBe(depot)
  })

  it('selects what a run inside it says to select', () => {
    const e = editor()
    const session = e.begin('Dim the hall')
    session.run(dim(0.8, { select: ['sector:hall'] }))
    expect(e.selection.ids).toEqual(['sector:hall'])
  })

  it('drops a selected sector that a run inside it removed, live, and brings nothing back on cancel', () => {
    const e = editor()
    e.selection.set(['sector:dock'])
    const session = e.begin('Drop the dock')
    session.run(dropDock)
    expect(e.selection.ids).toEqual([])
    session.cancel()
    expect(e.selection.ids).toEqual([])
  })
})

describe('the parts of the editor', () => {
  it('has the profile and the level it was given, and a clean history', () => {
    const e = editor()
    expect(e.profile).toBe(afSectorProfile)
    expect(e.level).toBe(depot)
    expect(e.history.cleanRevision).toBe(e.history.revision)
  })

  it('is dirty after an edit and clean again after markClean', () => {
    const e = editor()
    e.run(dim(0.5))
    expect(e.history.cleanRevision).not.toBe(e.history.revision)
    e.history.markClean()
    expect(e.history.cleanRevision).toBe(e.history.revision)
  })

  it('keeps the view out of the undo history', () => {
    const e = editor()
    e.view.set({ mode: 'walk' })
    e.view.toggle('hidden', 'walls')
    expect(e.view.state.mode).toBe('walk')
    expect(e.history.canUndo).toBe(false)
    expect(e.history.revision).toBe(0)
    e.run(dim(0.5))
    e.history.undo()
    expect(e.view.state.mode).toBe('walk')
  })
})
