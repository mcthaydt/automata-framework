// The furniture, characters and lamps a level places, as things (Levels 3D spec §5, §7): defined from the game, read
// only, placed and moved through the existing thing edits, and every member the editor does not show kept as written.
import { readFileSync } from 'node:fs'
import type { AfSector2File } from '@automata/3d/level'
import { describe, expect, it } from 'vitest'
import { removeDefinition, renameDefinition, setDefinitionField } from '#src/shared/edit/definition-edits.ts'
import { addThing, moveThing, removeThing, setThingField } from '#src/shared/edit/thing-edits.ts'
import { afSectorChecks } from '#src/shared/level-session/af-sector/af-checks.ts'
import { afEntityKit } from '#src/shared/level-session/af-sector/af-entities.ts'
import { afThingAccess } from '#src/shared/level-session/af-sector/af-things.ts'
import { afSectorProfileFor } from '#src/shared/level-session/af-sector-profile.ts'
import { EMPTY_LIBRARY, readGameLibrary } from '#src/shared/level-session/game-library.ts'
import { afMaterials } from '#src/shared/level-session/materials.ts'
import { base3dWorkspace } from '#src/testing/game-files.ts'
import { toyAfSector } from '#src/testing/toy-af-sector.ts'

const TEXT = readFileSync(
  new URL('../../../../../../../games/base-3d/content/levels/room.af-sector.json', import.meta.url),
  'utf8',
)
const EMBER_HALL = JSON.parse(TEXT) as AfSector2File
const LIBRARY = await readGameLibrary('content/levels/room.af-sector.json', base3dWorkspace())
const profile = afSectorProfileFor(LIBRARY)
const thing = (def: string, id: string, x: number, z: number) => ({ def, id, x, z, values: {} })

describe('the things a level places', () => {
  it('Ember Hall’s crates are things you can move, turn and remove', () => {
    const kit = afEntityKit(EMBER_HALL, LIBRARY)
    const crates = kit.things.filter((each) => each.def === 'prop.crate')
    expect(crates.map((each) => each.id)).toEqual(['crate-1', 'crate-2', 'crate-3'])
    const crate2 = crates[1]
    if (crate2 === undefined) throw new Error('no crate-2')
    const moved = afThingAccess.replace(EMBER_HALL, 'prop.crate', 'crate-2', {
      ...crate2,
      x: 3,
      values: { angle: 90 },
    })
    expect(moved.props?.[1]).toEqual({ id: 'crate-2', use: 'crate', at: [3, 6.5], angle: 90 })
    expect(afThingAccess.remove(EMBER_HALL, 'prop.barrel', 'barrel-1').props?.map((each) => each.id)).toEqual(
      ['crate-1', 'crate-2', 'crate-3', 'barrel-2'],
    )
  })

  it('a crate placed from the palette is written as a prop', () => {
    expect(afThingAccess.add(EMBER_HALL, thing('prop.crate', 'crate-4', 0, 10)).props?.at(-1)).toEqual({
      id: 'crate-4',
      use: 'crate',
      at: [0, 10],
    })
  })

  it('offers every lamp the kit has, in words, so a lamp can be placed where there is none yet', () => {
    const lamps = profile
      .entities(toyAfSector({}))
      .definitions.filter((def) => def.group === 'lamps')
      .map((def) => def.label)
    expect(lamps).toEqual([
      'Pendant lamp',
      'Bulb lamp',
      'Desk lamp',
      'Fluorescent lamp',
      'Sodium lamp',
      'Neon lamp',
    ])
  })

  it('a lamp placed from the palette is written as a lamp of that kind', () => {
    expect(afThingAccess.add(EMBER_HALL, thing('lamp.sodium', 'lamp-sodium-1', 1, 2)).lamps?.at(-1)).toEqual({
      id: 'lamp-sodium-1',
      kind: 'sodium',
      at: [1, 2],
    })
  })

  it('the pendant lamp’s parameters stay as written when it is moved', () => {
    const level = toyAfSector({
      props: [{ id: 'prop0', use: 'lamp.pendant', at: [0, 0], with: { height: 2.25, ceiling: 2.7 } }],
    })
    const kit = afEntityKit(level, LIBRARY)
    const pendant = kit.things[0]
    if (pendant === undefined) throw new Error('no pendant')
    const moved = afThingAccess.replace(level, 'prop.lamp.pendant', 'prop0', { ...pendant, x: 0.5 })
    expect(moved.props?.[0]).toEqual({
      id: 'prop0',
      use: 'lamp.pendant',
      at: [0.5, 0],
      with: { height: 2.25, ceiling: 2.7 },
    })
  })

  it('a height is the third value of at, kept when the thing moves and written only when it is set', () => {
    const level = toyAfSector({
      lamps: [{ id: 'lamp-1', kind: 'pendant', at: [1, 2, 2.4], color: '#ffd9a0' }],
    })
    const lamp = afEntityKit(level, LIBRARY).things[0]
    if (lamp === undefined) throw new Error('no lamp')
    expect(lamp).toMatchObject({ def: 'lamp.pendant', x: 1, z: 2, y: 2.4 })
    const moved = afThingAccess.replace(level, 'lamp.pendant', 'lamp-1', { ...lamp, x: 4 })
    expect(moved.lamps?.[0]).toEqual({ id: 'lamp-1', kind: 'pendant', at: [4, 2, 2.4], color: '#ffd9a0' })
  })

  it('draws a thing whose furniture the game lacks, as a plain box named by its id', () => {
    const level = toyAfSector({ props: [{ id: 'piano-1', use: 'piano', at: [2, 2] }] })
    const kit = afEntityKit(level, LIBRARY)
    expect(kit.definitions.find((each) => each.id === 'prop.piano')).toMatchObject({
      label: 'Piano',
      shape: 'box',
      size: [0.5, 0.5, 0.5],
      readOnly: true,
      group: 'furniture',
    })
    expect(kit.things.map((each) => each.id)).toEqual(['piano-1'])
  })

  it('sizes a box from the game’s furniture, and a barrel from its radius', () => {
    const { definitions } = afEntityKit(EMBER_HALL, LIBRARY)
    expect(definitions.find((each) => each.id === 'prop.crate')).toMatchObject({ size: [0.7, 0.6, 0.7] })
    expect(definitions.find((each) => each.id === 'prop.barrel')).toMatchObject({ size: [0.6, 0.9, 0.6] })
  })

  it('every id is unused across entities, props, cast and lamps', () => {
    const level = toyAfSector({
      entities: [{ def: 'spawn', id: 'a', x: 1, z: 1 }],
      props: [{ id: 'b', use: 'crate', at: [1, 1] }],
      cast: [{ id: 'c', who: 'wick', at: [1, 1] }],
      lamps: [{ id: 'd', kind: 'pendant', at: [1, 1, 2] }],
    })
    expect([...afThingAccess.takenIds(level, 'prop.crate')].sort()).toEqual(['a', 'b', 'c', 'd'])
  })

  it('edits it through the thing edits: add, turn, move, remove, and the level it leaves reads back', () => {
    const added = addThing<AfSector2File>({ def: 'prop.crate', id: 'crate-4', x: 0, z: 2 }).run(
      profile,
      EMBER_HALL,
    )
    expect(added.ok).toBe(true)
    if (!added.ok) return
    const turned = setThingField<AfSector2File>({
      def: 'prop.crate',
      id: 'crate-4',
      field: 'angle',
      value: 90,
    }).run(profile, added.level)
    expect(turned.ok && turned.level.props?.at(-1)).toEqual({
      id: 'crate-4',
      use: 'crate',
      at: [0, 2],
      angle: 90,
    })
    const gone = removeThing<AfSector2File>({ def: 'prop.crate', id: 'crate-4' }).run(profile, added.level)
    expect(gone.ok && gone.level.props?.map((each) => each.id)).toEqual(
      EMBER_HALL.props?.map((each) => each.id),
    )
    const nudged = moveThing<AfSector2File>({ def: 'prop.crate', id: 'crate-1', x: -3, z: 6.5 }).run(
      profile,
      EMBER_HALL,
    )
    expect(nudged.ok && nudged.level.props?.[0]).toEqual({ id: 'crate-1', use: 'crate', at: [-3, 6.5] })
  })
})

const problemsOf = (level: AfSector2File, library = LIBRARY): string[] =>
  afSectorChecks(level, library).flatMap((check) => check.problems.map((problem) => problem.message))

describe('where placed things stand', () => {
  it('names a prop outside every room in words, once, and not in the engine’s words', () => {
    const level = {
      ...EMBER_HALL,
      props: [...(EMBER_HALL.props ?? []), { id: 'crate-9', use: 'crate', at: [100, 100] }],
    }
    const found = problemsOf(level)
    expect(found).toContain(
      'The crate "crate-9" stands outside every room. Move it into a room, or remove it.',
    )
    expect(found.filter((message) => message.includes('crate-9'))).toHaveLength(1)
  })

  it('names a lamp that sits in a wall', () => {
    const level = {
      ...EMBER_HALL,
      lamps: [
        { id: 'lamp-1', kind: 'pendant', at: [5, 4] },
        { id: 'lamp-2', kind: 'pendant', at: [0, 4] },
      ],
    }
    const found = problemsOf(level)
    expect(found).toContain('The pendant lamp "lamp-1" is inside a wall. Move it into the room.')
    expect(found.some((message) => message.includes('lamp-2'))).toBe(false)
  })

  it('still names a level’s own entity outside every room as before', () => {
    const level = {
      ...EMBER_HALL,
      entities: [...(EMBER_HALL.entities ?? []), { id: 'ember-9', def: 'ember', x: 100, z: 100 }],
    }
    expect(problemsOf(level)).toContain('entity ember-9 is outside every sector')
  })
})

describe('what the game lacks', () => {
  it('a prop the game lacks still opens and is named in the checks', () => {
    const level = {
      ...EMBER_HALL,
      props: [...(EMBER_HALL.props ?? []), { id: 'piano-1', use: 'piano', at: [0, 3] }],
    }
    expect(afEntityKit(level, LIBRARY).things.map((each) => each.id)).toContain('piano-1')
    expect(problemsOf(level)).toContain(
      'The room has furniture called "piano", but the game has none. Remove it, or add it to the game.',
    )
  })

  it('a character the game lacks is named, and one it has is not', () => {
    const level = {
      ...EMBER_HALL,
      cast: [
        { id: 'ada', who: 'ada', at: [0, 3] },
        { id: 'wick', who: 'wick', at: [0, 4] },
      ],
    }
    expect(problemsOf(level)).toEqual([
      'The room has a character called "ada", but the game has none. Remove it, or add it in Characters.',
    ])
  })

  it('a seeded material name is not missing', () => {
    const level = toyAfSector({
      sectors: [{ ...toyAfSector().sectors[0]!, floorTexture: 'lava#2' }, toyAfSector().sectors[1]!],
    })
    expect(problemsOf(level)).toEqual([])
  })

  it('a material the game lacks is named in words', () => {
    const level = toyAfSector({
      sectors: [{ ...toyAfSector().sectors[0]!, wallTexture: 'rust' }, toyAfSector().sectors[1]!],
    })
    expect(problemsOf(level)).toEqual([
      'The room "hall" uses a material called "rust", but the game has none. Choose another with Change materials.',
    ])
  })

  it('a game with no library asks nothing of the level and offers the file’s own names', () => {
    const level = toyAfSector({
      materials: { brick: { category: 'walls' } },
      props: [{ id: 'p', use: 'piano', at: [1, 1] }],
    })
    expect(afSectorChecks(level, EMPTY_LIBRARY).map((check) => check.id)).not.toContain('library')
    expect(afMaterials(level, EMPTY_LIBRARY)).toEqual({
      ok: true,
      materials: [{ id: 'brick', category: 'walls' }],
    })
  })

  it('the game’s materials are one category, each in words with its colour', () => {
    const list = afMaterials(toyAfSector(), LIBRARY)
    if (!list.ok) throw new Error(list.reason)
    expect(list.materials.find((each) => each.id === 'lava')).toEqual({
      id: 'lava',
      category: 'Materials',
      label: 'Lava',
      color: expect.stringMatching(/^#[0-9a-f]{6}$/),
    })
  })
})

describe('furniture, characters and lamps come from the game', () => {
  it('furniture is not changed here', () => {
    const refusal = "Crate comes from the game's furniture, so it can't be changed here."
    expect(
      renameDefinition<AfSector2File>({ def: 'prop.crate', to: 'box' }).run(profile, EMBER_HALL),
    ).toMatchObject({ ok: false, reason: refusal })
    expect(removeDefinition<AfSector2File>({ def: 'prop.crate' }).run(profile, EMBER_HALL)).toMatchObject({
      ok: false,
      reason: refusal,
    })
    expect(
      setDefinitionField<AfSector2File>({ def: 'prop.crate', value: { id: 'weight', type: 'float' } }).run(
        profile,
        EMBER_HALL,
      ),
    ).toMatchObject({ ok: false, reason: refusal })
  })
})
