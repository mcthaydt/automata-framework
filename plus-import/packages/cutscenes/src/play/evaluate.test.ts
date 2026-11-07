// `evaluate` (M6.9a step 2), from the source's cutscene cases: a script at time t. Pure and deterministic, so previews,
// replays and the lint see the same frame. The sim never calls it (cutscene time is ticks).
import { describe, expect, it } from 'vitest'
import type { PlacedScript } from '../sim/anchors'
import { CUTSCENE_LENS, evaluate, fovOf } from './evaluate'

const base: PlacedScript = {
  id: 'toy',
  duration: 4,
  camera: [
    { t: 0, pos: [0, 2, 5], look: [0, 1, 0] },
    { t: 2, pos: [2, 2, 5], look: [0, 1, 0], lens: 66 },
  ],
}
const actors = (...actor: NonNullable<PlacedScript['actor']>): PlacedScript => ({ ...base, actor })

describe('evaluate: time and the camera', () => {
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

describe('evaluate: actors', () => {
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

describe('evaluate: captions, lamps, states and fades', () => {
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
    expect(evaluate(s, 0.5).light).toBeNull()
    expect(evaluate(s, 1).light).toEqual({ ward: 1 })
    expect(evaluate(s, 2).light?.ward).toBeCloseTo(0.5)
    expect(evaluate(s, 3.5).light).toEqual({ ward: 0 })
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
