import { describe, expect, it } from 'vitest'
import type { CutsceneScript } from '#src/entries/sim.ts'
import { type LintFloor, type LintWorld, lintCutscene } from '#src/shared/lint.ts'

// The cutscene lint in a 2D game: the floor is its level's areas and walls (through `LintFloor`), and a step that only a
// 3D scene draws is said so, not silently dropped.

/** A 10 by 6 m room, solid on its bottom row (z 5 to 6). */
const FLOOR: LintFloor = {
  sectorAt: (p) => (p.x >= 0 && p.x <= 10 && p.z >= 0 && p.z <= 6 ? 'room' : undefined),
  segmentBlocked: (a, b) => Math.max(a.z, b.z) > 5,
}
const world = (over: Partial<LintWorld> = {}): LintWorld => ({
  map: FLOOR,
  dimensions: 2,
  text: { 'toy.a': 'The clock has stopped.' },
  sounds: new Set(['thud']),
  lamps: new Set(['hall']),
  doors: new Set(),
  props: new Set(),
  anchor: () => undefined,
  ...over,
})
const SCRIPT: CutsceneScript = {
  id: 'wake',
  duration: 4,
  // The camera's position is a 3D idea: a 2D stage looks at `look`, so `pos` may be anywhere.
  camera: [{ t: 0, pos: [50, 0, 50], look: [5, 0, 3] }],
  actor: [
    { who: 'ada', t: 0, x: 2, z: 2, moving: true },
    { who: 'ada', t: 4, x: 8, z: 2, moving: true },
  ],
  caption: [{ t: 0.2, until: 3.8, line: 'toy.a' }],
}
const rules = (script: CutsceneScript, over: Partial<LintWorld> = {}) =>
  lintCutscene(script, world(over)).map((f) => `${f.level} ${f.rule}`)

describe('lintCutscene in a 2D game', () => {
  it('passes a script that stays on the level’s floor, and does not hold the camera’s position to the floor', () => {
    expect(rules(SCRIPT)).toEqual([])
  })

  it('lets a character stand beside a wall: its point is where it stands, not the middle of a body', () => {
    // Blocked only within a body's clearance of the bottom wall, as the 3D floor is.
    const floor: LintFloor = {
      sectorAt: FLOOR.sectorAt,
      segmentBlocked: (a, b, margin) => (margin > 0 ? Math.max(a.z, b.z) > 4.9 : Math.max(a.z, b.z) > 5),
    }
    const standing = { ...SCRIPT, actor: SCRIPT.actor?.map((key) => ({ ...key, z: 5 })) }
    expect(rules(standing, { map: floor })).toEqual([])
    expect(rules(standing, { map: floor, dimensions: 3 })).toContain('error wall')
    // Inside a wall is still wrong.
    const inside = { ...SCRIPT, actor: SCRIPT.actor?.map((key) => ({ ...key, z: 5.5 })) }
    expect(rules(inside, { map: floor })).toContain('error wall')
  })

  it('warns when a character starts the scene somewhere other than where the level places it', () => {
    const found = lintCutscene(
      SCRIPT,
      world({ anchor: (name) => (name === 'actor:ada' ? { x: 6.5, z: 2 } : undefined) }),
    )
    expect(found.map((f) => [f.level, f.rule, f.detail])).toEqual([
      ['warning', 'start', 'ada starts this cutscene at 2, 2 but stands at 6.5, 2 in the level.'],
    ])
  })

  it('does not warn when the character starts where the level places it, or the level does not place it', () => {
    expect(rules(SCRIPT, { anchor: (name) => (name === 'actor:ada' ? { x: 2, z: 2 } : undefined) })).toEqual(
      [],
    )
    expect(rules(SCRIPT)).toEqual([])
  })

  it('warns that lamps, doors, props, the time of day, the grade and flicker only work in 3D games', () => {
    const found = lintCutscene(
      {
        ...SCRIPT,
        light: [{ t: 1, lamp: 'hall', level: 0.5 }],
        flicker: [[1, 2]],
        time: [{ t: 1, time: 'dusk' }],
      },
      world(),
    )
    expect(found.map((f) => [f.level, f.rule, f.detail])).toEqual([
      ['warning', '3d-only', 'This step only works in 3D games. It does nothing here. (light)'],
      ['warning', '3d-only', 'This step only works in 3D games. It does nothing here. (time)'],
      ['warning', '3d-only', 'This step only works in 3D games. It does nothing here. (flicker)'],
    ])
  })

  it('says nothing of the kind in a 3D game', () => {
    expect(
      rules({ ...SCRIPT, light: [{ t: 1, lamp: 'hall', level: 0.5 }] }, { dimensions: 3 }),
    ).not.toContain('warning 3d-only')
  })

  it('still reports an actor off every area as off the floor, and one in a wall', () => {
    const off: CutsceneScript = {
      ...SCRIPT,
      actor: [
        { who: 'ada', t: 0, x: 20, z: 2 },
        { who: 'ada', t: 4, x: 20, z: 2 },
      ],
    }
    expect(rules(off)).toContain('error floor')
    const wall: CutsceneScript = {
      ...SCRIPT,
      actor: [
        { who: 'ada', t: 0, x: 2, z: 5.5 },
        { who: 'ada', t: 4, x: 3, z: 5.5 },
      ],
    }
    expect(rules(wall)).toContain('error wall')
  })

  it('can be allowed, as any lint rule', () => {
    const allowed: CutsceneScript = {
      ...SCRIPT,
      light: [{ t: 1, lamp: 'hall', level: 0.5 }],
      lintAllow: [{ rule: '3d-only', reason: 'the same script plays in the 3D build' }],
    }
    expect(rules(allowed)).toEqual([])
  })
})
