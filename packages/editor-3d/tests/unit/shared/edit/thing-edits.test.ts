// The thing edits (ED3D.7a step 3): add, move, set a field and remove, on the depot (`af-sector/1`). The sentences are the entity
// check's (`entity crate2 is outside every sector`, `contents has no option "gold"`) where the check has one, and an
// edit that is accepted never makes a level the checks call worse than it was.

import type { AfSector } from '@automata/3d/level'
import { describe, expect, it } from 'vitest'
import type { Edit, EditResult } from '#src/shared/edit/edit.ts'
import { createLevelEditor } from '#src/shared/edit/level-editor.ts'
import { addThing, moveThing, removeThing, setThingField } from '#src/shared/edit/thing-edits.ts'
import { afSectorProfile } from '#src/shared/level-session/af-sector-profile.ts'
import type { LevelProfile } from '#src/shared/level-session/level-profile.ts'
import { ThingAccessError } from '#src/shared/level-session/thing-access.ts'
import { levelOf, must, reasonOf } from '#src/testing/edit-helpers.ts'
import { loadAuthored } from '#src/testing/fixtures.ts'
import { literalEdits } from '#src/testing/text-diff.ts'

const depotText = loadAuthored('depot.af-sector')
const depot = (() => {
  const result = afSectorProfile.parse(depotText)
  if (!result.ok) throw new Error('the depot does not parse')
  return result.value
})()

const runAf = (edit: Edit<AfSector>, level: AfSector = depot): EditResult<AfSector> =>
  edit.run(afSectorProfile, level)

/** The depot with a lamp that floats (it needs a colour, and has a range by default) and a switch that opens a thing. */
const lit: AfSector = {
  ...depot,
  entityDefs: [
    ...(depot.entityDefs ?? []),
    {
      id: 'lamp',
      shape: 'point',
      sit: 'free',
      fields: [
        { id: 'range', type: 'float', min: 0, default: 3 },
        { id: 'tint', type: 'color', required: true },
      ],
    },
    { id: 'switch', shape: 'point', fields: [{ id: 'opens', type: 'ref' }] },
  ],
  entities: [
    ...(depot.entities ?? []),
    { def: 'lamp', id: 'lamp1', x: 2, y: 2.5, z: 2, tint: '#ffcc88', range: 4 },
    { def: 'switch', id: 'sw1', x: 3, z: 2, opens: { target: 'crate1' } },
  ],
}

/** The depot with a hole in the hall (3 m to 4 m by 3 m to 4 m is outside every sector) and a thing no definition covers. */
const holed: AfSector = {
  ...depot,
  sectors: depot.sectors.map((sector) =>
    sector.id === 'hall'
      ? {
          ...sector,
          holes: [
            [
              [3, 3],
              [4, 3],
              [4, 4],
              [3, 4],
            ],
          ],
        }
      : sector,
  ),
}
const broken: AfSector = {
  ...depot,
  entities: [...(depot.entities ?? []), { def: 'barrel', id: 'b1', x: 1, z: 1 }],
}

/** Every problem of every check, by check: what a level reports before and after an edit. */
const problemsOf = <D>(profile: LevelProfile<D>, level: D): string[] =>
  profile
    .checks(level)
    .flatMap((result) => result.problems.map((problem) => `${result.id}: ${problem.message}`))

const crate = (id: string, more: Partial<Parameters<typeof addThing>[0]> = {}) =>
  addThing<AfSector>({ def: 'crate', id, x: 5, z: 3, values: { contents: 'tools' }, ...more })

describe('thing.add on an af-sector level', () => {
  it('appends the thing in the file’s order, fills the defaults it was not given, and selects it', () => {
    const result = runAf(crate('crate2'))
    expect(result).toMatchObject({ ok: true, select: ['entity:crate/crate2'] })
    const next = levelOf(result)
    expect(next.entities?.at(-1)).toEqual({ def: 'crate', id: 'crate2', x: 5, z: 3, contents: 'tools' })
    const plain = levelOf(runAf(addThing({ def: 'crate', id: 'crate3', x: 5, z: 3 })))
    expect(plain.entities?.at(-1)).toEqual({ def: 'crate', id: 'crate3', x: 5, z: 3, contents: 'supplies' })
    expect(next.entities?.slice(0, -1)).toEqual(depot.entities)
  })

  it('treats a field given as undefined as not given, and writes what is given to four decimals', () => {
    const next = levelOf(
      runAf(addThing({ def: 'crate', id: 'crate2', x: 5, z: 3, values: { contents: undefined } as never })),
    )
    expect(next.entities?.at(-1)).toEqual({ def: 'crate', id: 'crate2', x: 5, z: 3, contents: 'supplies' })
    const lamp = levelOf(
      runAf(
        addThing({ def: 'lamp', id: 'l', x: 2, z: 2, values: { tint: '#ffffff', range: 2.123456 } }),
        lit,
      ),
    )
    expect(lamp.entities?.at(-1)).toMatchObject({ range: 2.1235 })
  })

  it('names the thing of a definition that allows one that the level has, wherever it stands in the file', () => {
    const spawnLast: AfSector = { ...depot, entities: [...(depot.entities ?? [])].reverse() }
    expect(reasonOf(runAf(addThing({ def: 'spawn', id: 'spawn2', x: 2, z: 2 }), spawnLast))).toBe(
      'spawn allows one: entity spawn is there already',
    )
  })

  it('writes the place to four decimals, and no height for a thing that rests on the floor', () => {
    const next = levelOf(runAf(crate('crate2', { x: 5.123456, z: 3.00004 })))
    expect(next.entities?.at(-1)).toMatchObject({ x: 5.1235, z: 3 })
    expect(next.entities?.at(-1)).not.toHaveProperty('y')
  })

  it('writes only the fields that have a default or were given, in the definition’s order', () => {
    const next = levelOf(
      runAf(addThing({ def: 'lamp', id: 'lamp2', x: 2, z: 2, values: { tint: '#ffffff' } }), lit),
    )
    expect(Object.keys(next.entities?.at(-1) ?? {})).toEqual(['def', 'id', 'x', 'y', 'z', 'range', 'tint'])
    expect(next.entities?.at(-1)).toEqual({
      def: 'lamp',
      id: 'lamp2',
      x: 2,
      y: 0,
      z: 2,
      range: 3,
      tint: '#ffffff',
    })
  })

  it('gives a thing that floats the floor of its sector as its height, unless it was told one', () => {
    const lamp = (x: number, z: number, y?: number) =>
      levelOf(
        runAf(
          addThing({
            def: 'lamp',
            id: 'l',
            x,
            z,
            ...(y === undefined ? {} : { y }),
            values: { tint: '#ffffff' },
          }),
          lit,
        ),
      ).entities?.at(-1)
    expect(lamp(2, 2)).toMatchObject({ y: 0 })
    expect(lamp(10, 2)).toMatchObject({ y: -0.5 })
    expect(lamp(10, 2, 2.25)).toMatchObject({ y: 2.25 })
    expect(lamp(2, 2, 1.123456)).toMatchObject({ y: 1.1235 })
  })

  it('is one insert in the file, and the file read back is the level', () => {
    const next = levelOf(runAf(crate('crate2')))
    const patched = afSectorProfile.patch(depotText, depot, next)
    if (!patched.ok) throw new Error(patched.detail)
    expect(afSectorProfile.parse(patched.text)).toEqual({ ok: true, value: next })
  })

  it.each([
    ['a definition the level lacks', { def: 'barrel', id: 'b' }, 'no definition barrel'],
    ['an id that is none', { id: '1crate' }, 'the id must be an id: a letter, then letters, digits, - or _'],
    ['an id with a slash', { id: 'a/b' }, 'the id must be an id: a letter, then letters, digits, - or _'],
    ['an id with a colon', { id: 'a:b' }, 'the id must be an id: a letter, then letters, digits, - or _'],
    ['an empty id', { id: '' }, 'the id must be an id: a letter, then letters, digits, - or _'],
    ['an id a thing of the definition has', { id: 'crate1' }, 'there is already something called crate1'],
    ['an id a thing of another definition has', { id: 'spawn' }, 'there is already something called spawn'],
    [
      'a second of a definition that allows one',
      { def: 'spawn', id: 'spawn2' },
      'spawn allows one: entity spawn is there already',
    ],
    ['a place outside every sector', { x: 50 }, 'entity crate2 is outside every sector'],
    ['a place that is not a number', { x: Number.NaN }, 'the x must be a number'],
    ['a height for a thing on the floor', { y: 1 }, 'a crate rests on the floor and has no height'],
    [
      'a value that is no option',
      { values: { contents: 'gold' } },
      'entity crate2: contents has no option "gold"',
    ],
    [
      'a field the definition lacks',
      { values: { colour: 'red' } },
      'entity crate2: colour is not a field of this entity',
    ],
  ] as const)('refuses %s', (_name, change, reason) => {
    expect(reasonOf(runAf(addThing({ def: 'crate', id: 'crate2', x: 5, z: 3, ...change })))).toBe(reason)
  })

  it('refuses a place in a hole as it refuses one outside the hall', () => {
    expect(reasonOf(runAf(crate('crate2', { x: 3.5, z: 3.5 }), holed))).toBe(
      'entity crate2 is outside every sector',
    )
    expect(runAf(crate('crate2', { x: 1, z: 1 }), holed).ok).toBe(true)
  })

  it('refuses a missing required field, saying every one that is missing', () => {
    expect(reasonOf(runAf(addThing({ def: 'lamp', id: 'l', x: 2, z: 2 }), lit))).toBe(
      'entity l: tint is required',
    )
  })

  it('refuses a taken id even when the thing that has it cannot be read', () => {
    expect(reasonOf(runAf(crate('b1'), broken))).toBe('there is already something called b1')
  })

  it('answers with the engine’s sentence for a level that does not build', () => {
    const unbuildable: AfSector = { ...depot, sectors: [{ ...must(depot.sectors[0]), style: 'nope' }] }
    expect(reasonOf(runAf(crate('crate2'), unbuildable))).toContain('nope')
  })

  it('is called thing.add and says what it adds', () => {
    const edit = crate('crate2')
    expect(edit.id).toBe('thing.add')
    expect(edit.label).toBe('Add crate crate2')
    expect(edit.coalesce).toBeUndefined()
  })

  it('never makes the checks say more than they did', () => {
    for (const edit of [crate('crate2'), crate('crate3', { x: 12, z: 2 })])
      expect(problemsOf(afSectorProfile, levelOf(runAf(edit)))).toEqual(problemsOf(afSectorProfile, depot))
  })
})

describe('thing.move', () => {
  it('moves a thing where it stands in the list, to four decimals, keeping its fields', () => {
    const next = levelOf(runAf(moveThing({ def: 'crate', id: 'crate1', x: 12.123456, z: 3 })))
    expect(next.entities?.[1]).toEqual({ def: 'crate', id: 'crate1', x: 12.1235, z: 3, contents: 'tools' })
    expect(next.entities?.[0]).toBe(depot.entities?.[0])
    const patched = afSectorProfile.patch(depotText, depot, next)
    if (!patched.ok) throw new Error(patched.detail)
    expect(literalEdits(depotText, patched.text)).toEqual(['["entities",1,"x"]', '["entities",1,"z"]'])
  })

  it('is the level itself when the place is where it was, and says nothing for a place that rounds to it', () => {
    expect(levelOf(runAf(moveThing({ def: 'crate', id: 'crate1', x: 11, z: 2 })))).toBe(depot)
    expect(levelOf(runAf(moveThing({ def: 'crate', id: 'crate1', x: 11.00001, z: 2 })))).toBe(depot)
  })

  it('keeps the height of a thing that floats unless it is given one, and refuses one for a thing on the floor', () => {
    const kept = levelOf(runAf(moveThing({ def: 'lamp', id: 'lamp1', x: 3, z: 3 }), lit))
    expect(kept.entities?.[2]).toMatchObject({ x: 3, y: 2.5, z: 3 })
    const raised = levelOf(runAf(moveThing({ def: 'lamp', id: 'lamp1', x: 3, z: 3, y: 1.5 }), lit))
    expect(raised.entities?.[2]).toMatchObject({ y: 1.5 })
    expect(reasonOf(runAf(moveThing({ def: 'crate', id: 'crate1', x: 11, z: 2, y: 1 })))).toBe(
      'a crate rests on the floor and has no height',
    )
  })

  it('refuses a height that is not a number, and points at the thing for each reason', () => {
    expect(runAf(moveThing({ def: 'lamp', id: 'lamp1', x: 3, z: 3, y: Number.NaN }), lit)).toEqual({
      ok: false,
      reason: 'the y must be a number',
      at: 'entity:lamp/lamp1',
    })
    expect(runAf(moveThing({ def: 'crate', id: 'crate1', x: 11, z: 2, y: 1 }))).toEqual({
      ok: false,
      reason: 'a crate rests on the floor and has no height',
      at: 'entity:crate/crate1',
    })
  })

  it('refuses a place outside every sector or in a hole, and points at the thing', () => {
    const outside = runAf(moveThing({ def: 'crate', id: 'crate1', x: 99, z: 2 }))
    expect(outside).toEqual({
      ok: false,
      reason: 'entity crate1 is outside every sector',
      at: 'entity:crate/crate1',
    })
    expect(reasonOf(runAf(moveThing({ def: 'crate', id: 'crate1', x: 3.5, z: 3.5 }), holed))).toBe(
      'entity crate1 is outside every sector',
    )
  })

  it('refuses a place that is not a number, a thing the level lacks, and a thing that cannot be read', () => {
    expect(
      reasonOf(runAf(moveThing({ def: 'crate', id: 'crate1', x: 1, z: Number.POSITIVE_INFINITY }))),
    ).toBe('the z must be a number')
    expect(runAf(moveThing({ def: 'crate', id: 'ghost', x: 1, z: 1 }))).toEqual({
      ok: false,
      reason: 'no crate ghost',
      at: 'entity:crate/ghost',
    })
    expect(reasonOf(runAf(moveThing({ def: 'spawn', id: 'crate1', x: 1, z: 1 })))).toBe('no spawn crate1')
    expect(reasonOf(runAf(moveThing({ def: 'barrel', id: 'b1', x: 2, z: 2 }), broken))).toBe(
      'entity b1 is of definition barrel, which is not defined',
    )
  })

  it('coalesces per thing, and is called thing.move', () => {
    const edit = moveThing({ def: 'crate', id: 'crate1', x: 1, z: 1 })
    expect(edit.id).toBe('thing.move')
    expect(edit.label).toBe('Move crate crate1')
    expect(edit.coalesce).toBe('move:crate/crate1')
  })
})

describe('thing.setField', () => {
  const field = (
    id: string,
    name: string,
    value: Parameters<typeof setThingField>[0]['value'],
    def = 'crate',
  ) => setThingField<AfSector>({ def, id, field: name, value })

  it('sets a field in the place it has, and the patch changes that member and no other byte', () => {
    const next = levelOf(runAf(field('crate1', 'contents', 'empty')))
    expect(next.entities?.[1]).toEqual({ def: 'crate', id: 'crate1', x: 11, z: 2, contents: 'empty' })
    const patched = afSectorProfile.patch(depotText, depot, next)
    if (!patched.ok) throw new Error(patched.detail)
    expect(literalEdits(depotText, patched.text)).toEqual(['["entities",1,"contents"]'])
  })

  it('adds a field the thing did not have at the end, and clears one with null', () => {
    const bare = levelOf(runAf(field('crate1', 'contents', null)))
    expect(bare.entities?.[1]).toEqual({ def: 'crate', id: 'crate1', x: 11, z: 2 })
    const again = levelOf(runAf(field('crate1', 'contents', 'supplies'), bare))
    expect(Object.keys(again.entities?.[1] ?? {}).at(-1)).toBe('contents')
  })

  it('is the level itself when the value is the one the thing has, and when a field that is not there is cleared', () => {
    expect(levelOf(runAf(field('crate1', 'contents', 'tools')))).toBe(depot)
    const bare = levelOf(runAf(field('crate1', 'contents', null)))
    expect(bare).not.toBe(depot)
    expect(levelOf(runAf(field('crate1', 'contents', null), bare))).toBe(bare)
  })

  it('refuses a value the field does not take, a field the definition lacks, and a required field cleared', () => {
    expect(reasonOf(runAf(field('crate1', 'contents', 'gold')))).toBe(
      'entity crate1: contents has no option "gold"',
    )
    expect(reasonOf(runAf(field('crate1', 'contents', 4)))).toBe(
      'entity crate1: contents must be one of its options',
    )
    expect(reasonOf(runAf(field('crate1', 'colour', 'red')))).toBe(
      'entity crate1: colour is not a field of this entity',
    )
    expect(reasonOf(runAf(field('lamp1', 'tint', null, 'lamp'), lit))).toBe('entity lamp1: tint is required')
    expect(reasonOf(runAf(field('lamp1', 'tint', 'red', 'lamp'), lit))).toBe(
      'entity lamp1: tint must be a #rrggbb color',
    )
  })

  it('writes numbers to four decimals and checks the bounds on what is written', () => {
    const range = (value: number) => runAf(field('lamp1', 'range', value, 'lamp'), lit)
    expect(levelOf(range(2.123456)).entities?.[2]).toMatchObject({ range: 2.1235 })
    expect(reasonOf(range(-1))).toBe('entity lamp1: range must be at least 0')
    expect(reasonOf(range(Number.NaN))).toBe('entity lamp1: range must be a finite number')
  })

  it('does not blame an edit that changes nothing for a fault the level already had', () => {
    const faulty = { ...depot, name: 5 } as unknown as AfSector
    expect(levelOf(runAf(field('crate1', 'contents', 'tools'), faulty))).toBe(faulty)
    expect(reasonOf(runAf(field('crate1', 'contents', 'empty'), faulty))).toContain('the file cannot hold it')
  })

  it('refuses a thing the level lacks, and a thing that cannot be read', () => {
    expect(runAf(field('ghost', 'contents', 'tools'))).toEqual({
      ok: false,
      reason: 'no crate ghost',
      at: 'entity:crate/ghost',
    })
    expect(reasonOf(runAf(field('b1', 'contents', 'tools', 'barrel'), broken))).toBe(
      'entity b1 is of definition barrel, which is not defined',
    )
  })

  it('coalesces per field of a thing, and is called thing.setField', () => {
    const edit = field('crate1', 'contents', 'empty')
    expect(edit.id).toBe('thing.setField')
    expect(edit.label).toBe('Set contents of crate1')
    expect(edit.coalesce).toBe('field:crate/crate1/contents')
  })

  it('never makes the checks say more than they did', () => {
    const edits = [field('crate1', 'contents', 'empty'), field('crate1', 'contents', null)]
    for (const edit of edits)
      expect(problemsOf(afSectorProfile, levelOf(runAf(edit)))).toEqual(problemsOf(afSectorProfile, depot))
  })
})

describe('thing.remove', () => {
  it('takes a thing out, and leaves the others as they are', () => {
    const next = levelOf(runAf(removeThing({ def: 'crate', id: 'crate1' })))
    expect(next.entities).toEqual([depot.entities?.[0]])
    expect(next.entities?.[0]).toBe(depot.entities?.[0])
  })

  it('refuses while a ref of another thing points at it, saying which', () => {
    expect(runAf(removeThing({ def: 'crate', id: 'crate1' }), lit)).toEqual({
      ok: false,
      reason: 'crate crate1 is still referenced: entity sw1: opens points at crate1',
      at: 'entity:crate/crate1',
    })
    expect(runAf(removeThing({ def: 'switch', id: 'sw1' }), lit).ok).toBe(true)
  })

  it('refuses a thing the level lacks, even when something points at it', () => {
    const dangling: AfSector = {
      ...lit,
      entities: [
        ...(lit.entities ?? []),
        { def: 'switch', id: 'sw2', x: 4, z: 2, opens: { target: 'ghost' } },
      ],
    }
    expect(runAf(removeThing({ def: 'crate', id: 'ghost' }), dangling)).toEqual({
      ok: false,
      reason: 'no crate ghost',
      at: 'entity:crate/ghost',
    })
  })

  it('takes out a thing that cannot be read, so that it can be got rid of', () => {
    const next = levelOf(runAf(removeThing({ def: 'barrel', id: 'b1' }), broken))
    expect(next.entities).toEqual(depot.entities)
  })

  it('is called thing.remove and says what it takes away', () => {
    const edit = removeThing({ def: 'crate', id: 'crate1' })
    expect(edit.id).toBe('thing.remove')
    expect(edit.label).toBe('Remove crate crate1')
    expect(edit.coalesce).toBeUndefined()
  })
})

describe('an access that refuses', () => {
  const refusing: LevelProfile<AfSector> = {
    ...afSectorProfile,
    things: {
      ...afSectorProfile.things,
      add: () => {
        throw new ThingAccessError('no room in the file')
      },
      replace: () => {
        throw new ThingAccessError('the file is full')
      },
      remove: () => {
        throw new ThingAccessError('the file needs it')
      },
    },
  }

  it('hands its sentence on, and points at the thing it was about', () => {
    expect(crate('crate2').run(refusing, depot)).toEqual({ ok: false, reason: 'no room in the file' })
    expect(moveThing<AfSector>({ def: 'crate', id: 'crate1', x: 12, z: 2 }).run(refusing, depot)).toEqual({
      ok: false,
      reason: 'the file is full',
      at: 'entity:crate/crate1',
    })
    expect(
      setThingField<AfSector>({ def: 'crate', id: 'crate1', field: 'contents', value: 'empty' }).run(
        refusing,
        depot,
      ),
    ).toEqual({ ok: false, reason: 'the file is full', at: 'entity:crate/crate1' })
    expect(removeThing<AfSector>({ def: 'crate', id: 'crate1' }).run(refusing, depot)).toEqual({
      ok: false,
      reason: 'the file needs it',
      at: 'entity:crate/crate1',
    })
  })
})

describe('through the level editor', () => {
  const editor = (level = depot, now = () => 0) => createLevelEditor({ profile: afSectorProfile, level, now })

  it('puts a thing in, selects it, and undo and redo bring it out and in', () => {
    const e = editor()
    expect(e.run(crate('crate2')).ok).toBe(true)
    expect(e.selection.ids).toEqual(['entity:crate/crate2'])
    expect(e.level.entities).toHaveLength(3)
    e.history.undo()
    expect(e.level).toBe(depot)
    e.history.redo()
    expect(e.level.entities).toHaveLength(3)
  })

  it('records one step for two moves of one thing close together, and a step for each of two things', () => {
    let at = 0
    const e = editor(lit, () => at)
    e.run(moveThing({ def: 'crate', id: 'crate1', x: 10, z: 2 }))
    at = 50
    e.run(moveThing({ def: 'crate', id: 'crate1', x: 9, z: 2 }))
    e.history.undo()
    expect(e.level).toBe(lit)
    e.history.redo()
    e.run(moveThing({ def: 'lamp', id: 'lamp1', x: 3, z: 2 }))
    e.history.undo()
    expect(e.level.entities?.[1]).toMatchObject({ id: 'crate1', x: 9 })
  })

  it('leaves the history alone for a refusal', () => {
    const e = editor()
    expect(e.run(moveThing({ def: 'crate', id: 'crate1', x: 99, z: 2 })).ok).toBe(false)
    expect(e.history.canUndo).toBe(false)
  })
})
