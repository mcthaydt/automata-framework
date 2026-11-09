// The director, from the original's cutscene cases: a script at time t. A state comes from the keys alone, so previews,
// replays and the lint see the same frame. The sim never calls it (cutscene time is ticks).
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { CUTSCENE_LENS, createDirector, fovOf } from '#src/shared/director/director.ts'
import { type PlacedScript, placeScript } from '#src/shared/sim/anchors.ts'
import { SCENES, scriptsOf } from '#src/testing/converted-cutscenes.ts'
import { anchorFor } from '#src/testing/play-anchor.ts'

const noop = (): void => {}
/** The state of `script` at `t` from a director of its own. */
const evaluate = (script: PlacedScript, t: number) => createDirector(script, noop).stateAt(t)

const base: PlacedScript = {
  id: 'toy',
  duration: 4,
  camera: [
    { t: 0, pos: [0, 2, 5], look: [0, 1, 0] },
    { t: 2, pos: [2, 2, 5], look: [0, 1, 0], lens: 66 },
  ],
}
const actors = (...actor: NonNullable<PlacedScript['actor']>): PlacedScript => ({ ...base, actor })

describe('director: time and the camera', () => {
  it('is done at the duration and not before, and every frame is finite', () => {
    expect(evaluate(base, 0).done).toBe(false)
    expect(evaluate(base, 4).done).toBe(true)
    for (let t = 0; t <= 4; t += 0.25) expect(evaluate(base, t).camera.pos.every(Number.isFinite)).toBe(true)
  })
  it('keeps the play lens without keys and zooms between lenses', () => {
    expect(evaluate(base, 0).camera.fov).toBeCloseTo(fovOf(CUTSCENE_LENS))
    expect(evaluate(base, 2).camera.fov).toBeCloseTo(fovOf(66))
    expect(evaluate(base, 1).camera.fov).toBeCloseTo(fovOf((CUTSCENE_LENS + 66) / 2))
    expect(evaluate({ ...base, lens: 35 }, 0).camera.fov).toBeCloseTo(fovOf(35))
  })
  it('eases a move as its key asks', () => {
    const linear = {
      ...base,
      camera: [base.camera[0], { ...base.camera[1], ease: 'linear' as const }],
    } as PlacedScript
    expect(evaluate(linear, 0.5).camera.pos[0]).toBeCloseTo(0.5)
    expect(evaluate(base, 0.5).camera.pos[0]).toBeLessThan(0.5)
  })
  it('hard-cuts to a key that says so, and lands on it', () => {
    const cuts: PlacedScript = {
      ...base,
      camera: [
        { t: 0, pos: [0, 2, 5], look: [0, 1, 0] },
        { t: 2, pos: [9, 2, 5], look: [0, 1, 0], cut: true },
      ],
    }
    expect(evaluate(cuts, 1.99).camera.pos[0]).toBe(0)
    expect(evaluate(cuts, 2).camera.pos).toEqual([9, 2, 5])
  })
  it('shakes only inside its window, deterministically', () => {
    const s = { ...base, shake: [[1, 2, 0.1]] as [number, number, number][] }
    expect(evaluate(s, 0.5).camera.pos).toEqual(evaluate(base, 0.5).camera.pos)
    expect(evaluate(s, 1.2).camera.pos).not.toEqual(evaluate(base, 1.2).camera.pos)
    expect(evaluate(s, 1.2).camera.pos).toEqual(evaluate(s, 1.2).camera.pos)
  })
})

describe('director: actors', () => {
  it('walks an actor between keys by id, and has none for a time before its first key… as its first key', () => {
    const s = actors(
      { who: 'ada', t: 0, x: 0, z: 0, moving: true },
      { who: 'ada', t: 2, x: 4, z: 0, moving: true },
    )
    expect(evaluate(s, 1).actors.ada).toMatchObject({ moving: true })
    expect(evaluate(s, 1).actors.ada?.x).toBeGreaterThan(0)
    expect(evaluate(s, 3).actors.ada).toMatchObject({ x: 4, moving: false })
    expect(evaluate(base, 1).actors).toEqual({})
  })
  it('lifts an actor by its y keys', () => {
    const s = actors({ who: 'ada', t: 0, x: 0, z: 0 }, { who: 'ada', t: 1, x: 0, z: 0, y: 0.1 })
    expect(evaluate(s, 1).actors.ada?.y).toBeCloseTo(0.1)
    expect(evaluate(actors({ who: 'ada', t: 0, x: 0, z: 0 }), 1).actors.ada?.y).toBeUndefined()
  })
  const posed = actors(
    { who: 'p', t: 0, x: 0, z: 0 },
    { who: 'p', t: 1, x: 0, z: 0, pose: 'write' },
    { who: 'p', t: 3, x: 0, z: 0, pose: 'write', facing: 1 },
    { who: 'p', t: 5, x: 0, z: 0 },
    { who: 'p', t: 6, x: 2, z: 0, moving: true, pose: 'write' },
    { who: 'p', t: 8, x: 4, z: 0, moving: true, pose: 'write' },
  )
  it('plays a pose from its key, timed from the start of its run, and stops at a key without one', () => {
    expect(evaluate(posed, 0.5).actors.p?.pose).toBeUndefined()
    expect(evaluate(posed, 1).actors.p).toMatchObject({ pose: 'write', poseTime: 0 })
    expect(evaluate(posed, 4).actors.p).toMatchObject({ pose: 'write', poseTime: 3 })
    expect(evaluate(posed, 5.5).actors.p?.pose).toBeUndefined()
  })
  it('walks instead of posing while the actor moves', () => {
    const walking = evaluate(posed, 7).actors.p
    expect(walking?.moving).toBe(true)
    expect(walking?.pose).toBeUndefined()
  })
  it('adds nothing to an actor frame without poses', () => {
    expect(Object.keys(evaluate(posed, 0.5).actors.p ?? {})).toEqual(['x', 'z', 'alpha', 'facing', 'moving'])
  })
  it('holds the frame a key names, through the run, until a key names another', () => {
    const held = actors(
      { who: 'n', t: 0, x: 0, z: 0, pose: 'pulse', frame: 1 },
      { who: 'n', t: 0.8, x: 0, z: 0, pose: 'pulse', frame: 3 },
    )
    expect(evaluate(held, 0.4).actors.n).toMatchObject({ pose: 'pulse', poseFrame: 1 })
    expect(evaluate(held, 5).actors.n).toMatchObject({ pose: 'pulse', poseFrame: 3, poseTime: 5 })
    expect(evaluate(posed, 4).actors.p?.poseFrame).toBeUndefined()
  })
  it('keeps a close-up’s density and face from the last key that sets them', () => {
    const s = actors(
      { who: 'a', t: 0, x: 0, z: 0, density: 1.5, face: 'wince' },
      { who: 'a', t: 1, x: 0, z: 0 },
    )
    expect(evaluate(s, 2).actors.a).toMatchObject({ density: 1.5, face: 'wince' })
  })
  it('trembles a shivering actor sideways, the same each time', () => {
    const s = actors({ who: 'a', t: 0, x: 0, z: 0, shiver: 0.05 })
    expect(evaluate(s, 1).actors.a?.x).not.toBe(0)
    expect(evaluate(s, 1)).toEqual(evaluate(s, 1))
  })
})

describe('director: captions, lamps, states and fades', () => {
  const s: PlacedScript = {
    ...base,
    caption: [{ t: 1, until: 2, line: 'toy.a', speaker: 'ada' }],
    light: [
      { t: 1, lamp: 'ward', level: 1 },
      { t: 3, lamp: 'ward', level: 0 },
    ],
    fade: [
      { t: 0, value: 0 },
      { t: 4, value: 1 },
    ],
    flicker: [[2.5, 3]],
    states: [{ t: 1, state: 'cabinet.open' }],
  }
  it('shows the caption whose window holds t', () => {
    expect(evaluate(s, 0.5).caption).toBeNull()
    expect(evaluate(s, 1.5).caption).toMatchObject({ line: 'toy.a' })
    expect(evaluate(s, 2).caption).toBeNull()
  })
  it('overrides a lamp from its first key on, eased between keys', () => {
    expect(evaluate(s, 0.5).lamps).toEqual({})
    expect(evaluate(s, 1).lamps).toEqual({ ward: { level: 1 } })
    expect(evaluate(s, 2).lamps.ward?.level).toBeCloseTo(0.5)
    expect(evaluate(s, 3.5).lamps).toEqual({ ward: { level: 0 } })
  })
  it('eases a fade, flickers in its window, and shows the states reached with how long each has held', () => {
    expect(evaluate(s, 2).fade).toBeCloseTo(0.5)
    expect(evaluate(s, 2.6).flicker).toBe(true)
    expect(evaluate(s, 2).flicker).toBe(false)
    expect(evaluate(s, 3).states).toEqual(['cabinet.open'])
    expect(evaluate(s, 3).held).toEqual({ 'cabinet.open': 2 })
    expect(evaluate(s, 0.5).states).toEqual([])
  })
})

describe('director: the keys alone', () => {
  it('a state at t comes from the keys alone', () => {
    expect(createDirector(base, noop).stateAt(1.5)).toEqual(createDirector(base, noop).stateAt(1.5))
    const d = createDirector(base, noop)
    d.stateAt(3)
    expect(d.stateAt(1.5)).toEqual(createDirector(base, noop).stateAt(1.5))
  })
  it('holds the last values after the last key and the first before the first', () => {
    expect(evaluate(base, -1).camera.pos).toEqual([0, 2, 5])
    expect(evaluate(base, 9).camera.pos).toEqual([2, 2, 5])
    expect(evaluate(base, 9).camera.fov).toBeCloseTo(fovOf(66))
    expect(evaluate(base, -1).done).toBe(false)
  })
  it('keeps a camera key’s ease: the CSS curve it names, or the smoothstep it names none', () => {
    const named = (ease: unknown) =>
      ({ ...base, camera: [base.camera[0], { ...base.camera[1], ease }] }) as PlacedScript
    // CSS ease-out at u = 0.5 is 0.8021…, the smoothstep's 0.5.
    expect(evaluate(named('out'), 1).camera.pos[0]).toBeGreaterThan(
      evaluate(named('smooth'), 1).camera.pos[0],
    )
    expect(evaluate(named([1 / 3, 2 / 3, 2 / 3, 1]), 1).camera.pos[0]).toBeCloseTo(2 * 0.75, 9)
  })
})

describe('director: the pieces of the world', () => {
  const s: PlacedScript = {
    ...base,
    doors: [
      { t: 1, door: 'ward', open: 0 },
      { t: 3, door: 'ward', open: 1, ease: 'linear' },
    ],
    props: [
      { t: 1, prop: 'cup', at: [0, 1, 0], turn: 0 },
      { t: 3, prop: 'cup', at: [2, 1, 0], turn: 90, ease: 'linear' },
      { t: 3, prop: 'note', hidden: true },
    ],
    time: [
      { t: 1, time: 'dusk' },
      { t: 3, time: 'night' },
    ],
    grade: [{ t: 2, grade: 'cold' }],
  }
  it('leaves a door, a prop, the time and the grade as built until their first key', () => {
    const before = evaluate(s, 0.5)
    expect([before.doors, before.props, before.time, before.grade]).toEqual([{}, {}, '', ''])
  })
  it('opens a door between its keys', () => {
    expect(evaluate(s, 2).doors.ward).toBeCloseTo(0.5)
    expect(evaluate(s, 9).doors).toEqual({ ward: 1 })
  })
  it('moves and turns a prop between its keys, and hides it from its key on', () => {
    expect(evaluate(s, 2).props.cup).toEqual({ at: [1, 1, 0], turn: 45 })
    expect(evaluate(s, 4).props.note).toEqual({ hidden: true })
  })
  it('holds a time of day and a grade from the key that names it until the next', () => {
    expect([evaluate(s, 2).time, evaluate(s, 2.9).time, evaluate(s, 3).time]).toEqual([
      'dusk',
      'dusk',
      'night',
    ])
    expect([evaluate(s, 1.9).grade, evaluate(s, 2).grade]).toEqual(['', 'cold'])
  })
})

describe('director: cues', () => {
  const cueAt = (at: number, who: string, clip: string): PlacedScript => ({
    ...base,
    cues: [{ at, who, clip }],
  })
  it('a cue starts its clip at its time, once', () => {
    const calls: unknown[] = []
    const d = createDirector(cueAt(2, 'wick', 'reach'), (...a) => calls.push(a))
    d.stateAt(1.9)
    expect(calls).toEqual([])
    d.stateAt(2)
    expect(calls).toEqual([['wick', 'reach', 2]])
    d.stateAt(2.5)
    d.stateAt(3)
    expect(calls).toHaveLength(1)
  })
  it('starts every cue a jump passes, in time order', () => {
    const calls: unknown[] = []
    const script: PlacedScript = {
      ...base,
      cues: [
        { at: 3, who: 'b', clip: 'two' },
        { at: 1, who: 'a', clip: 'one' },
      ],
    }
    createDirector(script, (...a) => calls.push(a)).stateAt(4)
    expect(calls).toEqual([
      ['a', 'one', 1],
      ['b', 'two', 3],
    ])
  })
  it('starts a cue again when the scene is wound back before it and played past it', () => {
    const calls: unknown[] = []
    const d = createDirector(cueAt(2, 'wick', 'reach'), (...a) => calls.push(a))
    d.stateAt(3)
    d.stateAt(1)
    d.stateAt(3)
    expect(calls).toHaveLength(2)
  })
})

describe('director: the four converted scripts', () => {
  const recorded = JSON.parse(
    readFileSync(join(import.meta.dirname, '../../fixtures/frames.json'), 'utf8'),
  ) as {
    frames: Record<string, Record<string, unknown>[]>
  }
  /** Numbers within 1e-9 of each other, everything else equal; the object keys are compared as sets. */
  const same = (a: unknown, b: unknown, path: string): void => {
    if (typeof a === 'number' && typeof b === 'number') {
      expect(Math.abs(a - b), path).toBeLessThan(1e-9)
    } else if (Array.isArray(a) && Array.isArray(b)) {
      expect(a.length, path).toBe(b.length)
      for (const [i, v] of a.entries()) same(v, b[i], `${path}[${i}]`)
    } else if (typeof a === 'object' && a !== null && typeof b === 'object' && b !== null) {
      expect(Object.keys(a).sort(), path).toEqual(Object.keys(b).sort())
      for (const key of Object.keys(a)) same((a as never)[key], (b as never)[key], `${path}.${key}`)
    } else expect(a, path).toEqual(b)
  }
  it('play as they did before, every tenth of a second', () => {
    let frames = 0
    for (const scene of SCENES)
      for (const script of scriptsOf(scene)) {
        const placed = placeScript(script, anchorFor)
        if (!placed.ok) throw new Error(`${script.id} names an anchor the stand-in lacks`)
        const director = createDirector(placed.script, noop)
        const before = recorded.frames[`${scene}/${script.id}`] ?? []
        expect(before.length, script.id).toBeGreaterThan(0)
        before.forEach((old, i) => {
          const { light, ...rest } = old
          // The old frame's `light` was a level per lamp, or null; the state's `lamps` are `{ level }` per lamp, or none.
          const lamps = Object.fromEntries(
            Object.entries((light ?? {}) as Record<string, number>).map(([lamp, level]) => [lamp, { level }]),
          )
          const now = director.stateAt(i / 10)
          same(
            JSON.parse(
              JSON.stringify({
                ...now,
                lamps: undefined,
                doors: undefined,
                props: undefined,
                time: undefined,
                grade: undefined,
              }),
            ),
            JSON.parse(JSON.stringify(rest)),
            `${scene}/${script.id}@${i / 10}`,
          )
          same(JSON.parse(JSON.stringify(now.lamps)), lamps, `${scene}/${script.id}@${i / 10} lamps`)
          frames++
        })
      }
    expect(frames).toBeGreaterThan(3000)
  })
})
