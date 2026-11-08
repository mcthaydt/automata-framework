import type { PixiStageHooks } from '@automata/framework'
import type { StepResult } from '@automata/sim'
import { describe, expect, it, vi } from 'vitest'
import { cutsceneStage3d, showScene3d } from '#src/features/stage-3d/cutscene-stage-3d.ts'
import { createDirector, type SceneState } from '#src/shared/director/director.ts'
import type { PlacedScript } from '#src/shared/sim/anchors.ts'

// The cutscene on a 3D stage: the sim says a cutscene started (with the tick it began on) and ended; this plays the script
// with the director from those events and hands each moment to whatever draws the room. Nothing here changes the game
// (law 2), so a replay shows the same scene.

const HZ = 60
const SCRIPT: PlacedScript = {
  id: 'look',
  duration: 4,
  camera: [
    { t: 0, pos: [0, 5, 0], look: [3, 0, 2] },
    { t: 4, pos: [0, 5, 8], look: [3, 0, 2] },
  ],
}

/** One step of the sim at `tick`, with the events it emitted. */
const step = (tick: number, ...events: { type: string; payload: unknown }[]): StepResult =>
  ({ tick, events, render: {}, rejected: [] }) as unknown as StepResult
const started = (start: number, id = 'look') => ({
  type: 'cutscene.started',
  payload: { id, start, end: start + 4 * HZ },
})
const ended = (id = 'look') => ({ type: 'cutscene.ended', payload: { id, skipped: false, missing: [] } })

/** A display frame that falls exactly on the last step (`alpha` 1), or part way to it. */
const frame = (alpha = 1) => ({ alpha, frameMs: 16, paused: false })

/** One display frame after a sim step: the step's events, then the frame that draws it. */
function play(hooks: PixiStageHooks, result: StepResult, alpha = 1): void {
  hooks.apply?.(result)
  hooks.draw?.(frame(alpha))
}

function stage(scripts: Readonly<Record<string, PlacedScript>> = { look: SCRIPT }) {
  const show = vi.fn<(scene: SceneState) => void>()
  const hooks = cutsceneStage3d({ scripts, show })
  return { show, hooks }
}

describe('cutsceneStage3d', () => {
  it('shows the director’s moment of the script at the tick the scene started on', () => {
    const { show, hooks } = stage()
    play(hooks, step(10, started(10)))
    const expected = createDirector(SCRIPT, () => {}).stateAt(0)
    expect(show).toHaveBeenCalledTimes(1)
    expect(show.mock.calls[0]?.[0].camera).toEqual(expected.camera)
    expect(show.mock.calls[0]?.[0].camera).toMatchObject({ pos: [0, 5, 0], look: [3, 0, 2] })
    expect(show.mock.calls[0]?.[0].camera.fov).toBeGreaterThan(0)
  })

  it('moves the scene on by the sim’s ticks a second at each later step', () => {
    const { show, hooks } = stage()
    play(hooks, step(10, started(10)))
    play(hooks, step(10 + HZ))
    play(hooks, step(10 + 3 * HZ))
    const depth = show.mock.calls.map(([scene]) => scene.camera.pos[2])
    expect(depth[0]).toBe(0)
    expect(depth[1]).toBeGreaterThan(0)
    expect(depth[2]).toBeGreaterThan(depth[1] ?? 0)
    expect(depth[2]).toBeLessThan(8)
    expect(show.mock.calls[1]?.[0].camera).toEqual(createDirector(SCRIPT, () => {}).stateAt(1).camera)
  })

  it('counts a second as the ticks a second it was given', () => {
    const show = vi.fn<(scene: SceneState) => void>()
    const hooks = cutsceneStage3d({ scripts: { look: SCRIPT }, show, tickHz: 30 })
    play(hooks, step(0, started(0)))
    play(hooks, step(30))
    expect(show.mock.calls[1]?.[0].camera).toEqual(createDirector(SCRIPT, () => {}).stateAt(1).camera)
  })

  it('shows nothing before a scene starts, and nothing after it ends', () => {
    const { show, hooks } = stage()
    play(hooks, step(5))
    expect(show).not.toHaveBeenCalled()
    play(hooks, step(10, started(10)))
    play(hooks, step(20))
    show.mockClear()
    play(hooks, step(30, ended()))
    play(hooks, step(40))
    expect(show).not.toHaveBeenCalled()
  })

  it('shows nothing for a scene whose script it was not given, or when the game is reset', () => {
    const { show, hooks } = stage()
    play(hooks, step(10, started(10, 'other')))
    expect(show).not.toHaveBeenCalled()
    play(hooks, step(20, started(20)))
    show.mockClear()
    hooks.reset?.()
    play(hooks, step(30))
    expect(show).not.toHaveBeenCalled()
  })

  it('plays the scene that started last when one replaces another', () => {
    const second: PlacedScript = {
      ...SCRIPT,
      id: 'second',
      camera: [{ t: 0, pos: [9, 9, 9], look: [0, 0, 0] }],
    }
    const { show, hooks } = stage({ look: SCRIPT, second })
    play(hooks, step(10, started(10)))
    play(hooks, step(20, ended(), started(20, 'second')))
    expect(show.mock.calls.at(-1)?.[0].camera.pos).toEqual([9, 9, 9])
  })
})

describe('cutsceneStage3d, against a camera that draws every frame', () => {
  // The follow camera's driver writes the camera in `draw`, after every `apply` of the frame. A scene shown in `apply`
  // was overwritten before the picture was drawn (a 3D game's cutscene never moved the camera), so it shows in `draw`.
  it('shows nothing in a step; the frame that draws it shows the moment', () => {
    const { show, hooks } = stage()
    hooks.apply?.(step(10, started(10)))
    expect(show).not.toHaveBeenCalled()
    hooks.draw?.(frame())
    expect(show).toHaveBeenCalledTimes(1)
  })

  it('shows the moment after the other hooks of the same frame have drawn', () => {
    const order: string[] = []
    const show = vi.fn(() => order.push('scene'))
    const hooks = cutsceneStage3d({ scripts: { look: SCRIPT }, show })
    const camera: PixiStageHooks = { draw: () => order.push('follow camera') }
    const merged = [camera, hooks]
    for (const h of merged) h.apply?.(step(10, started(10)))
    for (const h of merged) h.draw?.(frame())
    expect(order).toEqual(['follow camera', 'scene'])
  })

  it('moves on between two steps by how far the frame is towards the next', () => {
    const { show, hooks } = stage()
    play(hooks, step(10, started(10)))
    play(hooks, step(10 + HZ), 0.5)
    const halfWay = show.mock.calls.at(-1)?.[0].camera.pos[2] ?? 0
    play(hooks, step(10 + HZ), 1)
    const onTheStep = show.mock.calls.at(-1)?.[0].camera.pos[2] ?? 0
    expect(halfWay).toBeLessThan(onTheStep)
  })

  it('stops showing once the scene ends, even for a frame drawn before the next step', () => {
    const { show, hooks } = stage()
    play(hooks, step(10, started(10)))
    hooks.apply?.(step(20, ended()))
    show.mockClear()
    hooks.draw?.(frame())
    expect(show).not.toHaveBeenCalled()
  })
})

describe('showScene3d', () => {
  it('writes the camera the director gave, then the pieces and the lamps of the same moment', () => {
    const calls: string[] = []
    const camera = { set: vi.fn(() => calls.push('camera')) }
    const pieces = vi.fn(() => calls.push('pieces'))
    const lamps = vi.fn(() => calls.push('lamps'))
    const scene = createDirector(SCRIPT, () => {}).stateAt(0)
    showScene3d({ camera, pieces, lamps })(scene)
    expect(camera.set).toHaveBeenCalledWith(scene.camera)
    expect(pieces).toHaveBeenCalledWith(scene)
    expect(lamps).toHaveBeenCalledWith(scene.lamps)
    expect(calls).toEqual(['camera', 'pieces', 'lamps'])
  })

  it('needs only a camera', () => {
    const camera = { set: vi.fn() }
    showScene3d({ camera })(createDirector(SCRIPT, () => {}).stateAt(0))
    expect(camera.set).toHaveBeenCalledTimes(1)
  })
})
