// The renderer's side of the heading (M3 spec §4.2, §5): it reads `view` and `heading` from the render rows and
// calls the rig, cutting to the first view, easing on a view change (and to the heading when the view sets one),
// tracking the heading every other frame, and following the followed component's interpolated position.
import type { RenderDelta, RenderRow, StepResult } from '@mcthaydt/automata-sim'
import { Camera3D } from '@pixi/3d'
import { describe, expect, it } from 'vitest'
import { cameraView } from '../sim/camera-view.schema.js'
import { angledCamera, type CameraRig } from './angled-camera.js'
import { cameraDriver } from './camera-driver.js'
import { eyeOf } from './camera-pose.js'

const VIEWS = [cameraView('hall'), cameraView('north', { yawDeg: 90 })]
const QUARTER = 16_384

function fakeRig() {
  const calls: string[] = []
  let views = new Map(VIEWS.map((v) => [v.id, v]))
  const rig: CameraRig = {
    lensMm: 24,
    setViews: (next) => {
      views = new Map(next.map((v) => [v.id, v]))
      calls.push('setViews')
    },
    viewOf: (id) => views.get(id),
    activate: (id, how) => calls.push(`activate ${id} ${how}`),
    heading: (yaw, how = 'track') => calls.push(`heading ${yaw} ${how}`),
    follow: (x, y, z) => calls.push(`follow ${x} ${y} ${z}`),
    frame: () => calls.push('frame'),
    update: (s) => calls.push(`update ${s}`),
    pose: () => undefined,
  }
  return { rig, calls }
}

const player = (view: string, heading: number, x: number): RenderRow => ({
  sid: 7,
  components: { 'camera-heading': { view, heading }, body: { x, y: 0, z: 0 } },
})
const delta = (part: Partial<RenderDelta>): StepResult => ({
  tick: 0,
  events: [],
  rejected: [],
  render: { resync: false, added: [], changed: [], removed: [], ...part },
})
const rigs: CameraRig[] = []
const frame = (alpha: number) => ({ alpha, frameMs: 16, paused: false })

function driven() {
  const { rig, calls } = fakeRig()
  const hooks = cameraDriver(rig, { views: VIEWS, initial: 'hall', follow: 'body' })
  rigs.push(rig)
  const draw = (alpha: number) => {
    calls.length = 0
    hooks.draw?.(frame(alpha))
    return [...calls]
  }
  return { hooks, draw, calls }
}

describe('cameraDriver', () => {
  it('draws nothing to the rig but the frame before the player has a row', () => {
    const { draw } = driven()
    expect(draw(1)).toEqual(['update 0.016'])
  })

  it('cuts to the first view, tracks its heading and follows the position', () => {
    const { hooks, draw } = driven()
    hooks.apply?.(delta({ added: [player('hall', QUARTER, 2)] }))
    expect(draw(1)).toEqual(['activate hall cut', 'heading 90 track', 'follow 2 0 0', 'update 0.016'])
  })

  it('interpolates the position between ticks and tracks the latest heading exactly: nothing eases between finger and camera', () => {
    const { hooks, draw } = driven()
    hooks.apply?.(delta({ added: [player('hall', 65_000, 0)] }))
    draw(1)
    hooks.apply?.(delta({ changed: [player('hall', 1_000, 4)] }))
    const calls = draw(0.5)
    expect(calls).toContain('follow 2 0 0')
    expect(calls).toContain(`heading ${(1_000 * 360) / 65_536} track`)
  })

  it('a row still in no view (view "") draws no view yet, and the first real view is a cut (review #245, 5)', () => {
    const { hooks, draw } = driven()
    hooks.apply?.(delta({ added: [player('', 0, 1)] }))
    expect(draw(1)).toEqual(['follow 1 0 0', 'update 0.016'])
    hooks.apply?.(delta({ changed: [player('hall', 0, 1)] }))
    expect(draw(1)[0]).toBe('activate hall cut')
  })

  it('reads views through the rig, so setViews changes whether an entry eases the heading', () => {
    const { hooks, draw } = driven()
    rigs.at(-1)?.setViews([cameraView('hall'), cameraView('north')])
    hooks.apply?.(delta({ added: [player('hall', 0, 0)] }))
    draw(1)
    hooks.apply?.(delta({ changed: [player('north', 0, 0)] }))
    expect(draw(1)).toContain('heading 0 track')
  })

  it('a row that did not change holds still', () => {
    const { hooks, draw } = driven()
    hooks.apply?.(delta({ added: [player('hall', 0, 3)] }))
    hooks.apply?.(delta({}))
    expect(draw(0.5)).toContain('follow 3 0 0')
  })

  it('eases into a new view, and eases to its heading when the view sets one', () => {
    const { hooks, draw } = driven()
    hooks.apply?.(delta({ added: [player('hall', 0, 0)] }))
    draw(1)
    hooks.apply?.(delta({ changed: [player('north', QUARTER, 0)] }))
    expect(draw(0.5)).toEqual(['activate north ease', 'heading 90 ease', 'follow 0 0 0', 'update 0.016'])
    // Later frames track the same target, which lets the ease finish.
    expect(draw(0.8)).toContain('heading 90 track')
  })

  it('a view with no yawDeg keeps the player’s heading and only tracks it', () => {
    const { hooks, draw } = driven()
    hooks.apply?.(delta({ added: [player('north', QUARTER, 0)] }))
    draw(1)
    hooks.apply?.(delta({ changed: [player('hall', QUARTER, 0)] }))
    expect(draw(1)).toEqual(['activate hall ease', 'heading 90 track', 'follow 0 0 0', 'update 0.016'])
  })

  it('forgets the player when its row is removed or on a reset, and cuts again after', () => {
    const { hooks, draw } = driven()
    hooks.apply?.(delta({ added: [player('hall', 0, 0)] }))
    draw(1)
    hooks.apply?.(delta({ removed: [7] }))
    expect(draw(1)).toEqual(['update 0.016'])
    hooks.apply?.(delta({ added: [player('north', QUARTER, 0)] }))
    expect(draw(1)[0]).toBe('activate north cut')
    hooks.reset?.()
    expect(draw(1)).toEqual(['update 0.016'])
  })

  it('a resync starts over from its rows', () => {
    const { hooks, draw } = driven()
    hooks.apply?.(delta({ added: [player('hall', 0, 0)] }))
    draw(1)
    hooks.apply?.(delta({ resync: true, added: [player('north', QUARTER, 5)] }))
    expect(draw(0.5)).toEqual(['activate north cut', 'heading 90 track', 'follow 5 0 0', 'update 0.016'])
  })
})

describe('cameraDriver with the real rig (review #245, 1)', () => {
  it('frames the player where the first row puts them, however many frames came before, and again after a reset', () => {
    const camera = new Camera3D()
    const rig = angledCamera({
      camera,
      views: VIEWS,
      initial: 'hall',
      reducedMotion: () => false,
      warn: () => {},
    })
    const hooks = cameraDriver(rig, { views: VIEWS, initial: 'hall', follow: 'body' })
    hooks.draw?.(frame(1))
    hooks.draw?.(frame(1))
    hooks.apply?.(delta({ added: [player('hall', 0, 50)] }))
    hooks.draw?.(frame(1))
    const at = (x: number) => eyeOf({ x, y: 1, z: 0 }, 0, 25, 5)
    expect(camera.position.x).toBeCloseTo(at(50).x, 4)
    expect(camera.position.z).toBeCloseTo(at(50).z, 4)
    hooks.reset?.()
    hooks.draw?.(frame(1))
    hooks.apply?.(delta({ resync: true, added: [player('hall', 0, -30)] }))
    hooks.draw?.(frame(1))
    expect(camera.position.x).toBeCloseTo(at(-30).x, 4)
    expect(camera.position.z).toBeCloseTo(at(-30).z, 4)
  })
})
