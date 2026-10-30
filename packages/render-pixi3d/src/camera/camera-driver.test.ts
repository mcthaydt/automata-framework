// The renderer's side of the heading (M3 spec §4.2, §5): it reads `view` and `heading` from the render rows and
// calls the rig, cutting to the first view, easing on a view change (and to the heading when the view sets one),
// tracking the heading every other frame, and following the followed component's interpolated position.
import type { RenderDelta, RenderRow, StepResult } from '@mcthaydt/automata-sim'
import { describe, expect, it } from 'vitest'
import { cameraView } from '../sim/camera-view.schema.js'
import type { CameraRig } from './angled-camera.js'
import { cameraDriver } from './camera-driver.js'

const VIEWS = [cameraView('hall'), cameraView('north', { yawDeg: 90 })]
const QUARTER = 16_384

function fakeRig() {
  const calls: string[] = []
  const rig: CameraRig = {
    lensMm: 24,
    setViews: () => calls.push('setViews'),
    activate: (id, how) => calls.push(`activate ${id} ${how}`),
    heading: (yaw, how = 'track') => calls.push(`heading ${yaw} ${how}`),
    follow: (x, y, z) => calls.push(`follow ${x} ${y} ${z}`),
    frame: () => calls.push('frame'),
    update: (s) => calls.push(`update ${s}`),
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
const frame = (alpha: number) => ({ alpha, frameMs: 16, paused: false })

function driven() {
  const { rig, calls } = fakeRig()
  const hooks = cameraDriver(rig, { views: VIEWS, initial: 'hall', follow: 'body' })
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

  it('interpolates the position and the heading between ticks, the shorter way', () => {
    const { hooks, draw } = driven()
    hooks.apply?.(delta({ added: [player('hall', 65_000, 0)] }))
    draw(1)
    hooks.apply?.(delta({ changed: [player('hall', 1_000, 4)] }))
    const calls = draw(0.5)
    expect(calls).toContain('follow 2 0 0')
    const heading = Number(calls.find((c) => c.startsWith('heading'))?.split(' ')[1])
    // From 65,000 to 1,000 is 1,536 units forward through 0: halfway is 65,768, which wraps to 232.
    expect(heading).toBeCloseTo((232 * 360) / 65_536, 9)
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
