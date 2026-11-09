// The renderer's side of the heading (M3 spec §4.2, §5): it reads `view` and `heading` from the render rows and
// calls the rig, cutting to the first view, easing on a view change (and to the heading when the view sets one),
// tracking the heading every other frame, and following the followed component's interpolated position.
import type { RenderDelta, RenderRow, StepResult } from '@automata/sim'
import { Camera3D } from '@pixi/3d'
import { describe, expect, it } from 'vitest'
import { angledCamera, type CameraRig } from '#src/features/camera/angled-camera.ts'
import { cameraDriver } from '#src/features/camera/camera-driver.ts'
import { eyeOf } from '#src/features/camera/camera-pose.ts'
import { cameraView } from '#src/features/camera/sim/camera-view.schema.ts'

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

  it('eases a heading change the game says to ease (a recentre), on its first frame only; others track', () => {
    const { rig, calls } = fakeRig()
    const seen: [unknown, unknown][] = []
    const hooks = cameraDriver(rig, {
      views: VIEWS,
      initial: 'hall',
      follow: 'body',
      easeHeading: (curr, prev) => {
        seen.push([curr['camera-heading']?.heading, prev?.['camera-heading']?.heading])
        return curr['camera-heading']?.heading === QUARTER
      },
    })
    const draw = () => {
      calls.length = 0
      hooks.draw?.(frame(1))
      return calls.filter((call) => call.startsWith('heading'))
    }
    hooks.apply?.(delta({ added: [player('hall', 0, 0)] }))
    draw()
    hooks.apply?.(delta({ changed: [player('hall', QUARTER, 0)] }))
    expect(draw()).toEqual(['heading 90 ease'])
    // Later frames of the same tick track the same target, which lets the ease finish.
    expect(draw()).toEqual(['heading 90 track'])
    hooks.apply?.(delta({ changed: [player('hall', 1_000, 0)] }))
    expect(draw()).toEqual([`heading ${(1_000 * 360) / 65_536} track`])
    expect(seen).toContainEqual([QUARTER, 0])
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

describe('cameraDriver with position and lock readers (M3.7b part 3a)', () => {
  // A game whose sim keeps Q16.16 metres: the hero row holds them, the target row is another entity.
  const Q16 = 65_536
  const hero = (x: number, lockTarget: number): RenderRow => ({
    sid: 7,
    components: { 'camera-heading': { view: 'hall', heading: 0 }, hero: { x: x * Q16, z: 0, lockTarget } },
  })
  const target = (sid: number, x: number): RenderRow => ({
    sid,
    components: { target: { x: x * Q16, z: 0 } },
  })

  function readers() {
    const { rig, calls } = fakeRig()
    const framed: unknown[] = []
    rig.frame = (lock) => {
      framed.push(lock)
    }
    const hooks = cameraDriver(rig, {
      views: VIEWS,
      initial: 'hall',
      follow: 'hero',
      position: (c) => ({ x: Number(c.hero?.x) / Q16, y: 0, z: Number(c.hero?.z) / Q16 }),
      lock: (c, rowOf) => {
        const sid = Number(c.hero?.lockTarget ?? 0)
        const row = sid === 0 ? undefined : rowOf(sid)?.target
        return row === undefined ? undefined : { x: Number(row.x) / Q16, y: 1.2, z: Number(row.z) / Q16 }
      },
    })
    const draw = (alpha: number) => {
      calls.length = 0
      framed.length = 0
      hooks.draw?.(frame(alpha))
      return { calls: [...calls], framed: [...framed] }
    }
    return { hooks, draw }
  }

  it('follows the position the reader gives, interpolated between ticks', () => {
    const { hooks, draw } = readers()
    hooks.apply?.(delta({ added: [hero(2, 0)] }))
    expect(draw(1).calls).toContain('follow 2 0 0')
    hooks.apply?.(delta({ changed: [hero(4, 0)] }))
    expect(draw(0.5).calls).toContain('follow 3 0 0')
  })

  it('frames the lock target found by sid among every row, and clears it when the lock or the target goes', () => {
    const { hooks, draw } = readers()
    hooks.apply?.(delta({ added: [hero(0, 9), target(9, 3)] }))
    expect(draw(1).framed).toEqual([{ x: 3, y: 1.2, z: 0 }])
    hooks.apply?.(delta({ changed: [target(9, 5)] }))
    expect(draw(1).framed).toEqual([{ x: 5, y: 1.2, z: 0 }])
    hooks.apply?.(delta({ removed: [9] }))
    expect(draw(1).framed).toEqual([undefined])
    hooks.apply?.(delta({ added: [target(9, 3)], changed: [hero(0, 0)] }))
    expect(draw(1).framed).toEqual([undefined])
  })

  it('frames nothing before the player has a row, and forgets the rows on a resync', () => {
    const { hooks, draw } = readers()
    hooks.apply?.(delta({ added: [target(9, 3)] }))
    expect(draw(1).framed).toEqual([])
    hooks.apply?.(delta({ resync: true, added: [hero(0, 9)] }))
    expect(draw(1).framed).toEqual([undefined])
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
