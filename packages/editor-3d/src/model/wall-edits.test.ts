// The wall edits (ED3D.3 step 7): what a wall is (solid, portal, door, window), the members of a door and a window, its
// texture and its flags. On the depot (`af-sector/1`) and on small levels that show one rule each.

import type { AfSector } from '@automata/3d/level'
import { describe, expect, it } from 'vitest'
import { afSectorProfile } from '../profile/af-sector-profile'
import type { EditSector, EditWall } from '../profile/sector-access'
import { levelOf, must, reasonOf } from '../testing/edit-helpers'
import { loadAuthored } from '../testing/fixtures'
import { toyAfSector } from '../testing/toy-af-sector'
import type { Edit } from './edit'
import { createLevelEditor } from './level-editor'
import { setDoor, setWallFlags, setWallKind, setWallMaterial, setWallOcclude, setWindow } from './wall-edits'

const depot = (() => {
  const result = afSectorProfile.parse(loadAuthored('depot.af-sector'))
  if (!result.ok) throw new Error('the depot does not parse')
  return result.value
})()

const afOn = (level: AfSector, edit: Edit<AfSector>) => edit.run(afSectorProfile, level)
const afRun = (edit: Edit<AfSector>) => afOn(depot, edit)
const sector = (level: AfSector, id: string): EditSector =>
  must(afSectorProfile.sectors.list(level).find((each) => each.id === id))
/** The wall that starts at a corner, as written. */
const wallAt = (level: AfSector, id: string, corner: number) => must(sector(level, id).corners[corner])[2]
const openings = (level: AfSector) => must(afSectorProfile.checks(level).find((r) => r.id === 'openings'))

const DOOR = { at: 4, width: 1.2, height: 2.2 }
const WINDOW = { at: 4, width: 1.6, y0: 1, y1: 2.6 }

/** A hall and a dock beside it with a solid wall each along x = 8, so that a portal can be made between them. */
const [hall, dock] = [must(depot.sectors[0]), must(depot.sectors[1])]
const walled = (reverse: EditWall = {}): AfSector =>
  toyAfSector({
    sectors: [
      { ...hall, corners: hall.corners.map((corner, i) => (i === 1 ? ([8, 0] as const) : corner)) },
      {
        ...dock,
        corners: dock.corners.map((corner, i) => (i === 3 ? ([8, 6, reverse] as const) : corner)),
      },
    ],
  } as Partial<AfSector>)

/** One room, 3 m by 1 m and 2 m high, so that the defaults for a short wall in a low room show. */
const closet = toyAfSector({
  sectors: [
    {
      id: 'closet',
      floor: 0,
      ceiling: 2,
      light: 1,
      corners: [
        [0, 0],
        [1, 0],
        [1, 3],
        [0, 3],
      ],
    },
  ],
})

describe('wall.setKind: door and window', () => {
  it('makes a plain wall a door with a position, a width and a height that suit its length and the room', () => {
    const next = levelOf(afRun(setWallKind({ sector: 'hall', corner: 2, kind: 'door' })))
    expect(sector(next, 'hall').corners[2]).toEqual([8, 6, { door: DOOR }])
    expect(sector(next, 'dock')).toBe(sector(depot, 'dock'))
  })

  it('makes a plain wall a window the same way', () => {
    const next = levelOf(afRun(setWallKind({ sector: 'hall', corner: 2, kind: 'window' })))
    expect(sector(next, 'hall').corners[2]).toEqual([8, 6, { window: WINDOW }])
  })

  it('scales the defaults down for a wall that is short and a room that is low', () => {
    const door = levelOf(afOn(closet, setWallKind({ sector: 'closet', corner: 0, kind: 'door' })))
    expect(sector(door, 'closet').corners[0]).toEqual([0, 0, { door: { at: 0.5, width: 0.5, height: 1.7 } }])
    const window = levelOf(afOn(closet, setWallKind({ sector: 'closet', corner: 0, kind: 'window' })))
    expect(sector(window, 'closet').corners[0]).toEqual([
      0,
      0,
      { window: { at: 0.5, width: 0.5, y0: 0.5, y1: 1.3 } },
    ])
  })

  it('caps the defaults for a tall room and a long wall', () => {
    const tall = toyAfSector({
      sectors: [
        {
          id: 'tall',
          floor: 0,
          ceiling: 10,
          light: 1,
          corners: [
            [0, 0],
            [20, 0],
            [20, 3],
            [0, 3],
          ],
        },
      ],
    })
    const door = wallAt(
      levelOf(afOn(tall, setWallKind({ sector: 'tall', corner: 0, kind: 'door' }))),
      'tall',
      0,
    )
    expect(door).toEqual({ door: { at: 10, width: 1.2, height: 2.2 } })
    const window = wallAt(
      levelOf(afOn(tall, setWallKind({ sector: 'tall', corner: 0, kind: 'window' }))),
      'tall',
      0,
    )
    expect(window).toEqual({ window: { at: 10, width: 1.6, y0: 1, y1: 2.6 } })
  })

  it('keeps the door or the window a wall has when it is made one again, whatever its size', () => {
    const level = toyAfSector({
      sectors: [
        {
          ...hall,
          corners: [
            [0, 0, { door: { at: 1, width: 0.8, height: 2 } }],
            [8, 0, { window: { at: 2, width: 1, y0: 0.5, y1: 1.5 } }],
            [8, 6],
            [0, 6],
          ],
        },
      ],
    } as Partial<AfSector>)
    expect(levelOf(afOn(level, setWallKind({ sector: 'hall', corner: 0, kind: 'door' })))).toBe(level)
    expect(levelOf(afOn(level, setWallKind({ sector: 'hall', corner: 1, kind: 'window' })))).toBe(level)
  })

  it('writes the defaults to four decimals', () => {
    const odd = toyAfSector({
      sectors: [
        {
          id: 's',
          floor: 0,
          ceiling: 3.3333,
          light: 1,
          corners: [
            [0, 0],
            [1.00007, 0],
            [1, 3],
            [0, 3],
          ],
        },
      ],
    })
    const window = wallAt(levelOf(afOn(odd, setWallKind({ sector: 's', corner: 0, kind: 'window' }))), 's', 0)
    expect(window).toEqual({ window: { at: 0.5, width: 0.5, y0: 0.8333, y1: 2.1666 } })
  })

  it('takes the other feature off, and keeps every other member of the wall', () => {
    const next = levelOf(afRun(setWallKind({ sector: 'hall', corner: 0, kind: 'door' })))
    expect(wallAt(next, 'hall', 0)).toEqual({ door: DOOR })
    const doored = levelOf(afRun(setWallKind({ sector: 'hall', corner: 3, kind: 'window' })))
    expect(wallAt(doored, 'hall', 3)).toEqual({ window: { ...WINDOW, at: 3 } })
    const textured = toyAfSector({
      sectors: [
        {
          ...hall,
          corners: hall.corners.map((c, i) =>
            i === 2 ? ([8, 6, { texture: 'brick', handrail: 1, window: WINDOW }] as const) : c,
          ),
        },
      ],
    } as Partial<AfSector>)
    const turned = levelOf(afOn(textured, setWallKind({ sector: 'hall', corner: 2, kind: 'door' })))
    expect(wallAt(turned, 'hall', 2)).toEqual({ texture: 'brick', handrail: 1, door: DOOR })
  })

  it('takes a portal off the wall that becomes a door, on this side only, so `openings` names the other (ED3-e)', () => {
    const next = levelOf(afRun(setWallKind({ sector: 'hall', corner: 1, kind: 'door' })))
    expect(wallAt(next, 'hall', 1)).toEqual({ door: { ...DOOR, at: 3 } })
    expect(sector(next, 'dock')).toBe(sector(depot, 'dock'))
    expect(openings(next).ok).toBe(false)
    const editor = createLevelEditor({ profile: afSectorProfile, level: depot })
    editor.run(setWallKind({ sector: 'hall', corner: 1, kind: 'solid' }))
    expect(openings(editor.level).problems.map((p) => p.locator?.selection)).toEqual(['wall:dock/3'])
    editor.history.undo()
    expect(openings(editor.level).ok).toBe(true)
  })

  it('changes nothing for a wall that already is a door or a window', () => {
    expect(levelOf(afRun(setWallKind({ sector: 'hall', corner: 3, kind: 'door' })))).toBe(depot)
    expect(levelOf(afRun(setWallKind({ sector: 'hall', corner: 0, kind: 'window' })))).toBe(depot)
  })
})

describe('wall.setKind: solid', () => {
  it('takes a door, a window or a portal off a wall, keeping the rest of it', () => {
    expect(
      sector(levelOf(afRun(setWallKind({ sector: 'hall', corner: 3, kind: 'solid' }))), 'hall').corners[3],
    ).toEqual([0, 6])
    expect(
      sector(levelOf(afRun(setWallKind({ sector: 'hall', corner: 0, kind: 'solid' }))), 'hall').corners[0],
    ).toEqual([0, 0])
    expect(
      sector(levelOf(afRun(setWallKind({ sector: 'hall', corner: 1, kind: 'solid' }))), 'hall').corners[1],
    ).toEqual([8, 0])
    const busy = toyAfSector({
      sectors: [
        {
          ...hall,
          corners: hall.corners.map((c, i) =>
            i === 1
              ? ([
                  8,
                  0,
                  {
                    next: 'dock',
                    texture: 'brick',
                    frame: true,
                    mask: 'glass',
                    block: true,
                    maskTop: 2,
                    hatch: [1, 2],
                    handrail: 1,
                  },
                ] as const)
              : c,
          ),
        },
      ],
    } as Partial<AfSector>)
    const solid = levelOf(afOn(busy, setWallKind({ sector: 'hall', corner: 1, kind: 'solid' })))
    expect(wallAt(solid, 'hall', 1)).toEqual({ texture: 'brick', handrail: 1 })
  })

  it('changes nothing for a wall that is solid already', () => {
    expect(levelOf(afRun(setWallKind({ sector: 'hall', corner: 2, kind: 'solid' })))).toBe(depot)
  })
})

describe('wall.setKind: portal', () => {
  it('sets the portal on both sides in one step, taking a door or a window off the reverse', () => {
    const level = walled({ texture: 'plank', window: WINDOW })
    const next = levelOf(afOn(level, setWallKind({ sector: 'hall', corner: 1, kind: 'portal', to: 'dock' })))
    expect(sector(next, 'hall').corners[1]).toEqual([8, 0, { next: 'dock' }])
    expect(sector(next, 'dock').corners[3]).toEqual([8, 6, { texture: 'plank', next: 'hall' }])
    expect(openings(next).ok).toBe(true)
    const editor = createLevelEditor({ profile: afSectorProfile, level })
    editor.run(setWallKind({ sector: 'hall', corner: 1, kind: 'portal', to: 'dock' }))
    expect(editor.history.revision).toBe(1)
    editor.history.undo()
    expect(editor.level).toBe(level)
  })

  it('sets the reverse on a wall of a hole when the sector in the hole is the one that leads out', () => {
    const level = toyAfSector({
      sectors: [
        {
          id: 'outer',
          floor: 0,
          ceiling: 3,
          light: 1,
          corners: [
            [0, 0],
            [10, 0],
            [10, 10],
            [0, 10],
          ],
          holes: [
            [
              [3, 3],
              [3, 7],
              [7, 7],
              [7, 3],
            ],
          ],
        },
        {
          id: 'inner',
          floor: 0,
          ceiling: 3,
          light: 1,
          corners: [
            [3, 3],
            [7, 3],
            [7, 7],
            [3, 7],
          ],
        },
      ],
    })
    const next = levelOf(
      afOn(level, setWallKind({ sector: 'inner', corner: 0, kind: 'portal', to: 'outer' })),
    )
    expect(wallAt(next, 'inner', 0)).toEqual({ next: 'outer' })
    expect(sector(next, 'outer').holes?.[0]?.[3]).toEqual([7, 3, { next: 'inner' }])
    expect(sector(next, 'outer').holes?.[0]?.[0]).toEqual([3, 3])
    expect(sector(next, 'outer').corners).toEqual(sector(level, 'outer').corners)
  })

  it('works from the other side as well, and solid then portal gives the depot back', () => {
    const solid = levelOf(afRun(setWallKind({ sector: 'hall', corner: 1, kind: 'solid' })))
    const again = levelOf(afOn(solid, setWallKind({ sector: 'dock', corner: 3, kind: 'portal', to: 'hall' })))
    expect(again).toEqual(depot)
  })

  it('takes a door off the wall that becomes a portal, and keeps its other members', () => {
    const level = toyAfSector({
      sectors: [
        {
          ...hall,
          corners: hall.corners.map((c, i) =>
            i === 1 ? ([8, 0, { texture: 'brick', door: DOOR }] as const) : c,
          ),
        },
        { ...dock, corners: dock.corners.map((c, i) => (i === 3 ? ([8, 6] as const) : c)) },
      ],
    } as Partial<AfSector>)
    const next = levelOf(afOn(level, setWallKind({ sector: 'hall', corner: 1, kind: 'portal', to: 'dock' })))
    expect(wallAt(next, 'hall', 1)).toEqual({ texture: 'brick', next: 'dock' })
    expect(wallAt(next, 'dock', 3)).toEqual({ next: 'hall' })
  })

  it('changes nothing for a portal that is there already', () => {
    expect(levelOf(afRun(setWallKind({ sector: 'hall', corner: 1, kind: 'portal', to: 'dock' })))).toBe(depot)
  })

  it('refuses a portal into its own sector, into one that is not there, and one with no wall to meet it', () => {
    const portal = (to: string, corner = 1) =>
      afRun(setWallKind({ sector: 'hall', corner, kind: 'portal', to }))
    expect(reasonOf(portal('hall'))).toBe('a portal cannot lead into its own sector')
    expect(portal('nowhere')).toEqual({ ok: false, reason: 'no sector nowhere' })
    expect(reasonOf(portal('dock', 2))).toBe('sector dock has no wall over the same segment')
  })

  it('refuses a reverse wall that already leads into a third sector', () => {
    const level = walled({ next: 'annex' })
    expect(
      reasonOf(afOn(level, setWallKind({ sector: 'hall', corner: 1, kind: 'portal', to: 'dock' }))),
    ).toBe('the wall of dock over it already leads into annex')
  })

  it('finds the reverse wall in a loop written the other way round', () => {
    const level = toyAfSector({
      sectors: [
        { ...hall, corners: hall.corners.map((c, i) => (i === 1 ? ([8, 0] as const) : c)) },
        {
          ...dock,
          corners: [
            [8, 0],
            [8, 6],
            [14, 6],
            [14, 0],
          ],
        },
      ],
    } as Partial<AfSector>)
    const next = levelOf(afOn(level, setWallKind({ sector: 'hall', corner: 1, kind: 'portal', to: 'dock' })))
    expect(wallAt(next, 'dock', 0)).toEqual({ next: 'hall' })
  })
})

describe('wall edits: what they all refuse and how they are named', () => {
  it('refuses a sector that is not there and a wall that is not one of the outline', () => {
    expect(afRun(setWallMaterial({ sector: 'nowhere', corner: 0, texture: 'brick' }))).toEqual({
      ok: false,
      reason: 'no sector nowhere',
    })
    for (const corner of [-1, 4, 1.5, Number.NaN]) {
      const reason = `sector hall has no wall ${corner}`
      expect(reasonOf(afRun(setWallKind({ sector: 'hall', corner, kind: 'door' })))).toBe(reason)
      expect(reasonOf(afRun(setDoor({ sector: 'hall', corner, at: 1 })))).toBe(reason)
      expect(reasonOf(afRun(setWindow({ sector: 'hall', corner, at: 1 })))).toBe(reason)
      expect(reasonOf(afRun(setWallMaterial({ sector: 'hall', corner, texture: 'brick' })))).toBe(reason)
      expect(reasonOf(afRun(setWallFlags({ sector: 'hall', corner, handrail: 1 })))).toBe(reason)
      expect(reasonOf(afRun(setWallOcclude({ sector: 'hall', corner, occlude: 'fade' })))).toBe(reason)
    }
  })

  it('names itself: the id, the label that says what it does to which wall, and the key a stepper coalesces on', () => {
    const wall = { sector: 'hall', corner: 2 }
    expect(setWallKind({ ...wall, kind: 'door' }).id).toBe('wall.setKind')
    expect(setWallKind({ ...wall, kind: 'door' }).label).toBe('Make wall 2 of hall a door')
    expect(setWallKind({ ...wall, kind: 'window' }).label).toBe('Make wall 2 of hall a window')
    expect(setWallKind({ ...wall, kind: 'solid' }).label).toBe('Make wall 2 of hall solid')
    expect(setWallKind({ ...wall, kind: 'portal', to: 'dock' }).label).toBe(
      'Make wall 2 of hall a portal into dock',
    )
    expect(setWallKind({ ...wall, kind: 'door' }).coalesce).toBeUndefined()
    const door = setDoor({ ...wall, at: 1 })
    expect([door.id, door.label, door.coalesce]).toEqual([
      'wall.setDoor',
      'Set the door of wall 2 of hall',
      'door:hall/2',
    ])
    const window = setWindow({ ...wall, at: 1 })
    expect([window.id, window.label, window.coalesce]).toEqual([
      'wall.setWindow',
      'Set the window of wall 2 of hall',
      'window:hall/2',
    ])
    const material = setWallMaterial({ ...wall, texture: 'brick' })
    expect([material.id, material.label, material.coalesce]).toEqual([
      'wall.setMaterial',
      'Set the texture of wall 2 of hall',
      undefined,
    ])
    const flags = setWallFlags({ ...wall, handrail: 1 })
    expect([flags.id, flags.label, flags.coalesce]).toEqual([
      'wall.setFlags',
      'Set the flags of wall 2 of hall',
      'flags:hall/2',
    ])
    const occlude = setWallOcclude({ ...wall, occlude: 'fade' })
    expect([occlude.id, occlude.label, occlude.coalesce]).toEqual([
      'wall.setOcclude',
      'Set how wall 2 of hall is cut away',
      'occlude:hall/2',
    ])
  })
})

describe('wall.setDoor', () => {
  const door = (more: Partial<Parameters<typeof setDoor>[0]>) =>
    afRun(setDoor({ sector: 'hall', corner: 3, ...more }))
  const doorOf = (level: AfSector) => must(wallAt(level, 'hall', 3) as EditWall).door

  it('merges the members it is given into the door, to four decimals', () => {
    expect(doorOf(levelOf(door({ at: 2 })))).toEqual({ at: 2, width: 1.2, height: 2.2 })
    expect(doorOf(levelOf(door({ width: 2, height: 2.5 })))).toEqual({ at: 3, width: 2, height: 2.5 })
    expect(doorOf(levelOf(door({ at: 2.00004, width: 1.00006, height: 2.50004 })))).toEqual({
      at: 2,
      width: 1.0001,
      height: 2.5,
    })
  })

  it('names the door, and clears the name with null', () => {
    const named = levelOf(door({ id: 'front' }))
    expect(doorOf(named)).toEqual({ ...DOOR, at: 3, id: 'front' })
    const cleared = afOn(named, setDoor({ sector: 'hall', corner: 3, id: null }))
    expect(doorOf(levelOf(cleared))).toEqual({ at: 3, width: 1.2, height: 2.2 })
    expect(doorOf(levelOf(door({ id: null })))).toEqual({ at: 3, width: 1.2, height: 2.2 })
  })

  it('leaves the name of the door as it is when only its place changes', () => {
    const named = levelOf(door({ id: 'front' }))
    const moved = levelOf(afOn(named, setDoor({ sector: 'hall', corner: 3, at: 2 })))
    expect(doorOf(moved)).toStrictEqual({ at: 2, width: 1.2, height: 2.2, id: 'front' })
  })

  it('keeps the other members of the wall and of a door it does not know', () => {
    const level = toyAfSector({
      sectors: [
        {
          ...hall,
          corners: hall.corners.map((c, i) =>
            i === 3
              ? ([0, 6, { texture: 'brick', door: { at: 3, width: 1.2, height: 2.2, swing: 'in' } }] as const)
              : c,
          ),
        },
      ],
    } as Partial<AfSector>)
    const next = levelOf(afOn(level, setDoor({ sector: 'hall', corner: 3, at: 2 })))
    expect(wallAt(next, 'hall', 3)).toEqual({
      texture: 'brick',
      door: { at: 2, width: 1.2, height: 2.2, swing: 'in' },
    })
  })

  it('changes nothing when the door is as it is told to be', () => {
    expect(levelOf(door({ at: 3, width: 1.2, height: 2.2 }))).toBe(depot)
    expect(levelOf(door({ id: null }))).toBe(depot)
  })

  it('refuses a wall without a door, and a call that gives nothing', () => {
    expect(reasonOf(afRun(setDoor({ sector: 'hall', corner: 2, at: 1 })))).toBe('that wall has no door')
    expect(reasonOf(door({}))).toBe('give a position, a width, a height or an id')
  })

  it('refuses numbers that are not, a size of nothing, and a name that is empty', () => {
    expect(reasonOf(door({ at: Number.NaN }))).toBe('the door position must be a number')
    expect(reasonOf(door({ width: Number.POSITIVE_INFINITY }))).toBe('the door width must be a number')
    expect(reasonOf(door({ height: Number.NaN }))).toBe('the door height must be a number')
    expect(reasonOf(door({ width: 0 }))).toBe('the door width must be more than 0')
    expect(reasonOf(door({ width: -1 }))).toBe('the door width must be more than 0')
    expect(reasonOf(door({ height: 0 }))).toBe('the door height must be more than 0')
    expect(reasonOf(door({ id: ' ' }))).toBe('a door id is a name, not empty')
  })

  it('refuses a door that does not lie within the wall, and allows one that touches its ends', () => {
    const fit = 'the door does not fit the wall: it must lie between 0 and 6 m along it'
    expect(reasonOf(door({ at: 0.5 }))).toBe(fit)
    expect(reasonOf(door({ at: 5.5 }))).toBe(fit)
    expect(reasonOf(door({ width: 7 }))).toBe(fit)
    expect(door({ at: 0.6 }).ok).toBe(true)
    expect(door({ at: 5.4 }).ok).toBe(true)
  })

  it('forgives the float noise of a length: a door of 1.2 m ending at 1.7 m fits a wall that long', () => {
    const level = toyAfSector({
      sectors: [
        {
          id: 'cell',
          floor: 0,
          ceiling: 3,
          light: 1,
          corners: [
            [0, 0, { door: { at: 0.85, width: 0.8, height: 2 } }],
            [1.7, 0],
            [1.7, 3],
            [0, 3],
          ],
        },
      ],
    })
    expect(afOn(level, setDoor({ sector: 'cell', corner: 0, at: 1.1, width: 1.2 })).ok).toBe(true)
    expect(afOn(level, setDoor({ sector: 'cell', corner: 0, at: 1.1001, width: 1.2 })).ok).toBe(false)
  })
})

describe('wall.setWindow', () => {
  const window = (more: Partial<Parameters<typeof setWindow>[0]>) =>
    afRun(setWindow({ sector: 'hall', corner: 0, ...more }))
  const windowOf = (level: AfSector) => must(wallAt(level, 'hall', 0) as EditWall).window

  it('merges the members it is given into the window, to four decimals', () => {
    expect(windowOf(levelOf(window({ at: 3 })))).toEqual({ ...WINDOW, at: 3 })
    expect(windowOf(levelOf(window({ y0: 0.5, y1: 3 })))).toEqual({ ...WINDOW, y0: 0.5, y1: 3 })
    expect(windowOf(levelOf(window({ at: 3.00004, width: 2.00004, y0: 0.50006, y1: 2.50004 })))).toEqual({
      at: 3,
      width: 2,
      y0: 0.5001,
      y1: 2.5,
    })
  })

  it('sets bars and the moon, and clears them with null', () => {
    const set = levelOf(window({ bars: 4, moon: true }))
    expect(windowOf(set)).toEqual({ ...WINDOW, bars: 4, moon: true })
    const cleared = levelOf(afOn(set, setWindow({ sector: 'hall', corner: 0, bars: null, moon: null })))
    expect(windowOf(cleared)).toEqual(WINDOW)
    expect(windowOf(levelOf(window({ moon: false })))).toEqual({ ...WINDOW, moon: false })
  })

  it('changes nothing when the window is as it is told to be', () => {
    expect(levelOf(window({ at: 4, width: 1.6, y0: 1, y1: 2.6 }))).toBe(depot)
    expect(levelOf(window({ bars: null, moon: null }))).toBe(depot)
  })

  it('refuses a wall without a window, and a call that gives nothing', () => {
    expect(reasonOf(afRun(setWindow({ sector: 'hall', corner: 2, at: 1 })))).toBe('that wall has no window')
    expect(reasonOf(window({}))).toBe('give a position, a width, a bottom, a top, bars or the moon')
  })

  it('refuses numbers that are not, a width of nothing, a bottom not under the top and bars of nothing', () => {
    expect(reasonOf(window({ at: Number.NaN }))).toBe('the window position must be a number')
    expect(reasonOf(window({ width: Number.NaN }))).toBe('the window width must be a number')
    expect(reasonOf(window({ y0: Number.NaN }))).toBe('the window bottom must be a number')
    expect(reasonOf(window({ y1: Number.POSITIVE_INFINITY }))).toBe('the window top must be a number')
    expect(reasonOf(window({ bars: Number.NaN }))).toBe('the window bars must be a number')
    expect(reasonOf(window({ width: 0 }))).toBe('the window width must be more than 0')
    expect(reasonOf(window({ bars: 0 }))).toBe('the window bars must be more than 0')
    const order = "the window's bottom must be under its top"
    expect(reasonOf(window({ y0: 2.6 }))).toBe(order)
    expect(reasonOf(window({ y1: 1 }))).toBe(order)
    expect(reasonOf(window({ y0: 3, y1: 2 }))).toBe(order)
  })

  it('refuses a window that does not lie within the wall', () => {
    const fit = 'the window does not fit the wall: it must lie between 0 and 8 m along it'
    expect(reasonOf(window({ at: 0.5 }))).toBe(fit)
    expect(reasonOf(window({ at: 7.5 }))).toBe(fit)
    expect(reasonOf(window({ width: 9 }))).toBe(fit)
    expect(window({ at: 0.8 }).ok).toBe(true)
  })
})

describe('wall.setMaterial', () => {
  it('sets the texture of a wall and clears it, dropping the wall when nothing else is left', () => {
    const set = levelOf(afRun(setWallMaterial({ sector: 'hall', corner: 2, texture: 'brick' })))
    expect(sector(set, 'hall').corners[2]).toEqual([8, 6, { texture: 'brick' }])
    const swapped = levelOf(afOn(set, setWallMaterial({ sector: 'hall', corner: 2, texture: 'tile' })))
    expect(wallAt(swapped, 'hall', 2)).toEqual({ texture: 'tile' })
    const cleared = levelOf(afOn(set, setWallMaterial({ sector: 'hall', corner: 2, texture: null })))
    expect(cleared).toEqual(depot)
    expect(must(sector(cleared, 'hall').corners[2])).toHaveLength(2)
  })

  it('keeps what else is on the wall, on a portal too', () => {
    const next = levelOf(afRun(setWallMaterial({ sector: 'hall', corner: 1, texture: 'brick' })))
    expect(wallAt(next, 'hall', 1)).toEqual({ next: 'dock', texture: 'brick' })
    const back = levelOf(afOn(next, setWallMaterial({ sector: 'hall', corner: 1, texture: null })))
    expect(back).toEqual(depot)
  })

  it('changes nothing for a texture that is there already, or none to clear', () => {
    const set = levelOf(afRun(setWallMaterial({ sector: 'hall', corner: 2, texture: 'brick' })))
    expect(levelOf(afOn(set, setWallMaterial({ sector: 'hall', corner: 2, texture: 'brick' })))).toBe(set)
    expect(levelOf(afRun(setWallMaterial({ sector: 'hall', corner: 2, texture: null })))).toBe(depot)
  })

  it('refuses a texture that is empty', () => {
    expect(reasonOf(afRun(setWallMaterial({ sector: 'hall', corner: 2, texture: '' })))).toBe(
      'a texture is a name, not empty',
    )
    expect(reasonOf(afRun(setWallMaterial({ sector: 'hall', corner: 2, texture: '  ' })))).toBe(
      'a texture is a name, not empty',
    )
  })
})

describe('wall.setOcclude (ED3D.4b)', () => {
  const occlude = (corner: number, value: Parameters<typeof setWallOcclude>[0]['occlude'], level = depot) =>
    afOn(level, setWallOcclude({ sector: 'hall', corner, occlude: value }))

  it('sets what the angled camera does to a wall, changes it and clears it, dropping the wall when nothing else is left', () => {
    const set = levelOf(occlude(2, 'never'))
    expect(sector(set, 'hall').corners[2]).toEqual([8, 6, { occlude: 'never' }])
    const swapped = levelOf(occlude(2, 'fade', set))
    expect(wallAt(swapped, 'hall', 2)).toEqual({ occlude: 'fade' })
    const cleared = levelOf(occlude(2, null, swapped))
    expect(cleared).toEqual(depot)
    expect(must(sector(cleared, 'hall').corners[2])).toHaveLength(2)
  })

  it('writes cut as written when asked, which is not the same as saying nothing', () => {
    expect(wallAt(levelOf(occlude(2, 'cut')), 'hall', 2)).toEqual({ occlude: 'cut' })
  })

  it('keeps what else is on the wall, on a portal too', () => {
    const next = levelOf(occlude(1, 'fade'))
    expect(wallAt(next, 'hall', 1)).toEqual({ next: 'dock', occlude: 'fade' })
    expect(levelOf(occlude(1, null, next))).toEqual(depot)
  })

  it('changes nothing for the value the wall has already, or none to clear', () => {
    const set = levelOf(occlude(2, 'fade'))
    expect(levelOf(occlude(2, 'fade', set))).toBe(set)
    expect(levelOf(occlude(2, null))).toBe(depot)
  })

  it('refuses a sector that is not there', () => {
    expect(afRun(setWallOcclude({ sector: 'nowhere', corner: 0, occlude: 'fade' }))).toEqual({
      ok: false,
      reason: 'no sector nowhere',
    })
  })

  it('refuses a value that is not one of the three', () => {
    for (const value of ['hide', '', 'Fade'])
      expect(reasonOf(occlude(2, value as 'fade'))).toBe('occlude is cut, fade or never')
  })
})

describe('wall.setFlags', () => {
  const flags = (corner: number, more: Partial<Parameters<typeof setWallFlags>[0]>) =>
    afRun(setWallFlags({ sector: 'hall', corner, ...more }))

  it('sets the height of a handrail on any wall, to four decimals, and clears it with null', () => {
    const set = levelOf(flags(2, { handrail: 1.00004 }))
    expect(sector(set, 'hall').corners[2]).toEqual([8, 6, { handrail: 1 }])
    expect(levelOf(afOn(set, setWallFlags({ sector: 'hall', corner: 2, handrail: null })))).toEqual(depot)
    expect(wallAt(levelOf(flags(1, { handrail: 0.9 })), 'hall', 1)).toEqual({ next: 'dock', handrail: 0.9 })
  })

  it('sets what belongs to a portal on a portal wall, and clears it with null', () => {
    const set = levelOf(flags(1, { frame: true, mask: 'glass', block: true, maskTop: 2.00004 }))
    expect(wallAt(set, 'hall', 1)).toEqual({
      next: 'dock',
      frame: true,
      mask: 'glass',
      block: true,
      maskTop: 2,
    })
    const cleared = levelOf(
      afOn(
        set,
        setWallFlags({ sector: 'hall', corner: 1, frame: null, mask: null, block: null, maskTop: null }),
      ),
    )
    expect(cleared).toEqual(depot)
    expect(wallAt(levelOf(flags(1, { mask: 'bars', frame: false })), 'hall', 1)).toEqual({
      next: 'dock',
      mask: 'bars',
      frame: false,
    })
  })

  it('refuses what belongs to a portal on a wall that is not one, and lets such a flag be cleared', () => {
    expect(reasonOf(flags(2, { frame: true }))).toBe('a frame is for a portal wall')
    expect(reasonOf(flags(2, { mask: 'glass' }))).toBe('a mask is for a portal wall')
    expect(reasonOf(flags(2, { block: true }))).toBe('blocking is for a portal wall')
    expect(reasonOf(flags(2, { maskTop: 2 }))).toBe('a mask height is for a portal wall')
    expect(levelOf(flags(2, { frame: null, mask: null, block: null, maskTop: null }))).toBe(depot)
  })

  it('refuses heights that are not numbers or not more than 0, a mask that is neither, and a call that gives nothing', () => {
    expect(reasonOf(flags(2, { handrail: Number.NaN }))).toBe('the handrail height must be a number')
    expect(reasonOf(flags(2, { handrail: 0 }))).toBe('the handrail height must be more than 0')
    expect(reasonOf(flags(1, { maskTop: Number.NaN }))).toBe('the mask height must be a number')
    expect(reasonOf(flags(1, { maskTop: -1 }))).toBe('the mask height must be more than 0')
    expect(reasonOf(flags(1, { mask: 'wire' as 'glass' }))).toBe('a mask is glass or bars')
    expect(reasonOf(flags(2, {}))).toBe('give a flag to set')
  })

  it('changes nothing for flags that are as they are told to be', () => {
    const set = levelOf(flags(2, { handrail: 1 }))
    expect(levelOf(afOn(set, setWallFlags({ sector: 'hall', corner: 2, handrail: 1 })))).toBe(set)
    expect(levelOf(flags(2, { handrail: null }))).toBe(depot)
  })
})
