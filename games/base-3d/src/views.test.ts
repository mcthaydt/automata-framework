import { describe, expect, it } from 'vitest'
import { ACTION_CLIP, HERO_MOVES, metres, WALK_SPEED } from './constants/index.ts'
import { FIRST_SLICE } from './content/first-slice.ts'
import {
  HERO_ITEM,
  heroFigureState,
  lockPoint,
  PILLAR,
  PROPS,
  placed,
  recentred,
  sceneOf,
  staticPieces,
} from './views/index.ts'

// The render rows as the figure view reads them (M3 spec §4.4.5): turn units to radians, ticks to seconds at
// 60 Hz, the action code to its clip id, the guard to a stance, the lock to aim points.

const hero = { x: 0, z: 0, facing: 0, moving: false, moveDir: 0, lockTarget: 0 }
const idle = { clip: 0, startedAt: 0, guard: false, guardSince: 0 }

describe('heroFigureState', () => {
  it('stands holding the sword, with no action, stance or aim', () => {
    expect(heroFigureState({ hero, 'hero-action': idle })).toEqual({
      moving: false,
      speed: 0,
      moveDir: 0,
      item: HERO_ITEM,
    })
  })

  it('walks at the walk speed, his travel against his facing in radians', () => {
    const state = heroFigureState({ hero: { ...hero, moving: true, moveDir: -16_384 }, 'hero-action': idle })
    expect(state).toMatchObject({ moving: true, speed: WALK_SPEED })
    expect(state.moveDir).toBeCloseTo(-Math.PI / 2, 12)
  })

  it('plays the action by its clip id from its start in seconds, and the guard as a stance', () => {
    const action = { clip: ACTION_CLIP.slash, startedAt: 90, guard: true, guardSince: 30 }
    expect(heroFigureState({ hero, 'hero-action': action })).toMatchObject({
      action: { id: 'slash', startedAt: 1.5 },
      stances: [{ id: 'guard', startedAt: 0.5 }],
    })
    expect(heroFigureState({ hero, 'hero-action': { ...idle, clip: ACTION_CLIP.pickup } }).action?.id).toBe(
      'pickup',
    )
  })

  it('plays the running move’s own clip, retimed to its total, from the action’s start (GAME-3D.1c part 3)', () => {
    const swinging = { clip: ACTION_CLIP.slash, startedAt: 120, guard: false, guardSince: 0 }
    const slash2 = HERO_MOVES.findIndex((move) => move.id === 'slash-2') + 1
    expect(
      heroFigureState({ hero, 'hero-action': swinging, fighter: { move: slash2 } }, undefined, HERO_MOVES),
    ).toMatchObject({
      action: { id: 'slash-2', startedAt: 2, length: 24 / 60 },
    })
    const roll = HERO_MOVES.findIndex((move) => move.id === 'roll') + 1
    const rolling = { ...swinging, clip: ACTION_CLIP.move }
    expect(
      heroFigureState({ hero, 'hero-action': rolling, fighter: { move: roll } }, undefined, HERO_MOVES)
        .action,
    ).toMatchObject({ id: 'roll', length: 24 / 60 })
    // Point and pickup are not moves: their clips play at their own length, as before.
    expect(
      heroFigureState({ hero, 'hero-action': { ...idle, clip: ACTION_CLIP.point } }, undefined, HERO_MOVES)
        .action,
    ).toEqual({ id: 'point', startedAt: 0 })
  })

  it('aims the head and chest at the locked target’s head and chest, in metres', () => {
    const target = { x: metres(2), z: metres(9) }
    const state = heroFigureState({ hero: { ...hero, lockTarget: 7 }, 'hero-action': idle }, target)
    expect(state.aim).toEqual([
      { part: 'head', at: [2, 1.5, 9] },
      { part: 'chest', at: [2, 1.2, 9] },
    ])
    // No lock, no aim, even with a target given.
    expect(heroFigureState({ hero, 'hero-action': idle }, target).aim).toBeUndefined()
  })
})

describe('placed', () => {
  it('turns a Q16.16 row into metres on the floor, facing in radians', () => {
    const pose = placed({ x: metres(2), z: metres(-1), facing: 16_384 })
    expect(pose).toMatchObject({ x: 2, y: 0, z: -1 })
    expect(pose.yaw).toBeCloseTo(Math.PI / 2, 12)
    // A row with no facing (a target) faces the way it is given.
    expect(placed({ x: 0, z: 0 }, 1).yaw).toBe(1)
  })
})

describe('lockPoint', () => {
  const rows: Record<number, Record<string, Record<string, number>>> = {
    7: { target: { x: metres(2), z: metres(9) } },
  }
  const rowOf = (sid: number) => rows[sid]

  it('frames the locked target’s chest, in metres', () => {
    expect(lockPoint({ hero: { ...hero, lockTarget: 7 } }, rowOf)).toEqual({ x: 2, y: 1.2, z: 9 })
  })

  it('frames nothing with no lock, or a lock on an entity with no row', () => {
    expect(lockPoint({ hero }, rowOf)).toBeUndefined()
    expect(lockPoint({ hero: { ...hero, lockTarget: 8 } }, rowOf)).toBeUndefined()
  })
})

describe('sceneOf the first slice', () => {
  const scene = sceneOf(FIRST_SLICE)

  it('draws one wall per area wall, its inside face toward a room and its thickness outward', () => {
    expect(scene.walls).toHaveLength(FIRST_SLICE.walls.length)
    // The hall's south wall faces north into the hall (the room on the left of a → b).
    expect(scene.walls[0]).toMatchObject({ a: { x: -4.2, z: -4 }, b: { x: 4.2, z: -4 }, thickness: 0.2 })
    // The west wall faces east.
    expect(scene.walls[1]).toMatchObject({ a: { x: -4, z: 12.2 }, b: { x: -4, z: -4.2 } })
    // The dividing wall west of the doorway faces the hall, south.
    expect(scene.walls[4]).toMatchObject({ a: { x: -1, z: 3.9 }, b: { x: -4, z: 3.9 }, thickness: 0.2 })
    for (const wall of scene.walls) expect(wall.height).toBeGreaterThan(2)
  })

  it('sets the ember on the floor at its place, a 0.3 m block', () => {
    // Rounded to the millimetre: the sums are not exact in binary.
    const round = (values: readonly number[]) => values.map((value) => Math.round(value * 1000) / 1000)
    expect(round(scene.ember.min)).toEqual([-3.35, 0, 11.05])
    expect(round(scene.ember.max)).toEqual([-3.05, 0.3, 11.35])
  })

  it('lays a floor and a ceiling over each room', () => {
    expect(scene.floors).toEqual([
      { min: [-4, -0.1, -4], max: [4, 0, 4] },
      { min: [-4, -0.1, 4], max: [4, 0, 12] },
    ])
    expect(scene.ceilings).toHaveLength(2)
    for (const ceiling of scene.ceilings) expect(ceiling.min[1]).toBe(scene.walls[0]?.height)
  })

  it('stands a pillar tall enough to fade, and the three props, inside the rooms and clear of the route', () => {
    expect(PILLAR.max[1] - PILLAR.min[1]).toBeGreaterThan(1.5)
    expect(PROPS).toHaveLength(3)
    // The golden's walk runs up x = 0 to the doorway: nothing stands on it (props have no collider yet).
    for (const box of [PILLAR]) expect(box.min[0] > 0.5 || box.max[0] < -0.5).toBe(true)
    for (const prop of PROPS) expect(Math.abs(prop.x)).toBeGreaterThan(1)
  })
})

describe('recentred (DESIGN.md §11.2: a lock press with no target eases the heading to the facing)', () => {
  const at = (heading: number, facing: number, lockTarget = 0) => ({
    'camera-heading': { view: 'hall', heading },
    hero: { ...hero, facing, lockTarget },
  })

  it('is the heading jumping to Wick’s facing with no lock before or after', () => {
    expect(recentred(at(16_384, 16_384), at(0, 16_384))).toBe(true)
  })

  it('is not a turn, a heading already there, a lock’s assist or its release, or the first row', () => {
    expect(recentred(at(364, 16_384), at(0, 16_384))).toBe(false)
    expect(recentred(at(16_384, 16_384), at(16_384, 16_384))).toBe(false)
    expect(recentred(at(16_384, 16_384, 7), at(15_838, 16_384, 7))).toBe(false)
    expect(recentred(at(16_384, 16_384), at(15_838, 16_384, 7))).toBe(false)
    expect(recentred(at(16_384, 16_384), undefined)).toBe(false)
  })
})

describe('staticPieces (GAME-3D.1i)', () => {
  it('boxes the hook posts on the floor and the sling targets at their height, and nothing else', () => {
    const boxes = staticPieces({
      ...FIRST_SLICE,
      entities: [
        { def: 'hook-post', id: 'post', x: 2, z: 3 },
        { def: 'sling-target', id: 'eye', x: 0, z: 1, height: 2.6, targets: [] },
        { def: 'chest', id: 'c', x: 5, z: 5, contents: 'map' },
      ],
    })
    expect(boxes).toHaveLength(2)
    expect(boxes[0]?.box.min[1]).toBe(0)
    expect(boxes[1]?.box.min[1]).toBeCloseTo(2.4)
    expect(boxes[1]?.box.max[1]).toBeCloseTo(2.8)
  })
})
