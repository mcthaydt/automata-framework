import { DEFAULT_PALETTE } from '@automata/content'
import type { RenderRow } from '@automata/sim'
import { Container3D, type FlatMaterial, Mesh3D } from '@pixi/3d'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createSceneLight } from '../../../shared/render/light/scene-light.ts'
import { sceneLightingSchema } from '../../../shared/render/light/scene-lighting.schema.ts'
import { channels } from '../../../shared/render/light/vertex-light.ts'
import { emptyModels } from '../../../shared/render/model/load-models.ts'
import { tinted } from '../../../shared/render/views/box-view.ts'
import { fixtureFigures } from '../../../testing/fixture-library.ts'
import { fixtureMotion } from '../../../testing/fixture-motion.ts'
import { J } from '../body/rig.ts'
import type { EvaluateOptions, FigureState } from '../clips/figure-state.ts'
import { build } from '../figure/build.ts'
import { skeleton } from '../figure/figure-skeleton.ts'
import { materialColour } from './figure-colour.ts'
import { FIGURE_BUILD_BUDGET_MS, type FigureViewOptions, figure } from './figure-view.ts'

// Count the figures package's evaluations and builds, keeping what they do, and record what each evaluation saw.
const calls = vi.hoisted(() => ({
  evaluate: 0,
  build: 0,
  seen: [] as { state: FigureState; time: number; options: EvaluateOptions | undefined }[],
}))
vi.mock('../clips/evaluate.ts', async (original) => {
  const real = await original<typeof import('../clips/evaluate.ts')>()
  return {
    ...real,
    evaluate: (...args: Parameters<typeof real.evaluate>) => {
      calls.evaluate++
      const [, , state, time, , options] = args
      calls.seen.push({ state, time, options: options && { ...options } })
      return real.evaluate(...args)
    },
  }
})
vi.mock('../figure/build.ts', async (original) => {
  const real = await original<typeof import('../figure/build.ts')>()
  return {
    ...real,
    build: (...args: Parameters<typeof real.build>) => {
      calls.build++
      return real.build(...args)
    },
  }
})

const row: RenderRow = { sid: 1, components: { hero: { x: 0, y: 0, z: 0, yaw: 0 } } }

async function options(extra: Partial<FigureViewOptions> = {}) {
  const { figures, library } = await fixtureFigures()
  const { library: motion } = await fixtureMotion()
  const def = figures.wick
  if (def === undefined) throw new Error('no wick')
  let time = 0
  const clock = { set: (t: number) => (time = t) }
  return { def, clock, options: { library, motion, now: () => time, ...extra } satisfies FigureViewOptions }
}

beforeEach(() => {
  calls.evaluate = 0
  calls.build = 0
  calls.seen = []
})

describe('figure', () => {
  it('stands the figure on its position, interpolated between ticks and turned by yaw', async () => {
    const { def, options: o } = await options()
    const view = figure(def, o)(row, 'hero', emptyModels)
    if (view === undefined) throw new Error('no view')
    expect(view.container).toBeInstanceOf(Container3D)
    view.update?.({ hero: { x: 4, y: 0, z: 2, yaw: 1 } }, { hero: { x: 2, y: 0, z: 0, yaw: 0 } }, 0.5)
    expect([view.container.position.x, view.container.position.y, view.container.position.z]).toEqual([
      3, 0, 1,
    ])
    expect(view.container.rotation.y).toBeCloseTo(0.5)
    view.destroy?.()
  })

  it('evaluates the pose only when the pose step or what the sim says changes', async () => {
    let moving = false
    const { def, clock, options: o } = await options({ state: () => ({ moving }) })
    const view = figure(def, o)(row, 'hero', emptyModels)
    const first = calls.evaluate
    expect(first).toBe(1)
    // Within one pose step (the bounce gait's pose rate), nothing is evaluated again.
    view?.update?.(row.components)
    view?.update?.(row.components)
    expect(calls.evaluate).toBe(first)
    clock.set(1)
    view?.update?.(row.components)
    expect(calls.evaluate).toBe(first + 1)
    moving = true
    view?.update?.(row.components)
    expect(calls.evaluate).toBe(first + 2)
    view?.destroy?.()
  })

  it('evaluates what the sim says (action, stances, speed) at yaw 0, since the node carries the facing', async () => {
    const action = { id: 'slash', startedAt: 0.25 }
    const stances = [{ id: 'look', startedAt: 0 }]
    const {
      def,
      clock,
      options: o,
    } = await options({
      state: () => ({ moving: true, speed: 2, moveDir: 0.5, action, stances }),
    })
    const view = figure(def, o)(
      { sid: 1, components: { hero: { x: 0, y: 0, z: 0, yaw: 1 } } },
      'hero',
      emptyModels,
    )
    clock.set(0.3)
    view?.update?.({ hero: { x: 0, y: 0, z: 0, yaw: 1 } })
    const last = calls.seen[calls.seen.length - 1]
    expect(last?.time).toBe(0.3)
    expect(last?.state).toMatchObject({ moving: true, speed: 2, moveDir: 0.5, facing: 0, action, stances })
    view?.destroy?.()
  })

  it('poses the slash over the walk: the right hand leaves where the walk alone puts it', async () => {
    let action: { id: string; startedAt: number } | undefined
    const { def, clock, options: o } = await options({ state: () => ({ moving: false, action }) })
    const view = figure(def, o)(row, 'hero', emptyModels)
    const hand = () => {
      const drawing = view?.container.children[0] as Container3D
      // The joints are the drawing's first children, in the rig's joint order.
      const node = drawing.children[J['hand.R']] as Container3D
      return [node.position.x, node.position.y, node.position.z]
    }
    clock.set(0.2)
    view?.update?.(row.components)
    const still = hand()
    action = { id: 'slash', startedAt: 0 }
    view?.update?.(row.components)
    expect(hand()).not.toEqual(still)
    view?.destroy?.()
  })

  it('turns an aim point from world metres into the figure’s own frame', async () => {
    const aim = [{ part: 'head' as const, at: [3, 1.5, -2] as const }]
    const { def, options: o } = await options({ state: () => ({ moving: false, aim }) })
    // Standing at (1, 0, -2) and turned a quarter toward +x: the point (3, 1.5, -2) is 2 m straight ahead.
    const view = figure(def, o)(
      { sid: 1, components: { hero: { x: 1, y: 0, z: -2, yaw: Math.PI / 2 } } },
      'hero',
      emptyModels,
    )
    const at = calls.seen[0]?.state.aim?.[0]?.at ?? []
    expect(at[0]).toBeCloseTo(0, 9)
    expect(at[1]).toBeCloseTo(1.5, 9)
    expect(at[2]).toBeCloseTo(2, 9)
    view?.destroy?.()
  })

  it('passes the last evaluated time as previous, and one warned set, so a missing clip warns once', async () => {
    const warn = vi.fn()
    const {
      def,
      clock,
      options: o,
    } = await options({
      warn,
      measure: () => 0, // no build is slow here
      state: () => ({ moving: false, action: { id: 'no-such-clip', startedAt: 0 } }),
    })
    const view = figure(def, o)(row, 'hero', emptyModels)
    for (const t of [1, 2, 3]) {
      clock.set(t)
      view?.update?.(row.components)
    }
    expect(calls.seen.map((seen) => seen.options?.previous)).toEqual([undefined, 0, 1, 2])
    expect(warn.mock.calls.map(([message]) => message)).toEqual([expect.stringMatching(/no-such-clip/)])
    view?.destroy?.()
  })

  it('steps the hair spring in the view and passes its swing: walking trails the hair', async () => {
    const { def, clock, options: o } = await options({ state: () => ({ moving: true, speed: 3 }) })
    const view = figure(def, o)(row, 'hero', emptyModels)
    expect(calls.seen[0]?.state.hair).toEqual({ pitch: 0, roll: 0 })
    for (let t = 0.1; t < 2; t += 0.1) {
      clock.set(t)
      view?.update?.(row.components)
    }
    expect(calls.seen[calls.seen.length - 1]?.state.hair?.pitch ?? 0).toBeGreaterThan(0)
    view?.destroy?.()
  })

  it('rebuilds the parts once when the outfit or the item changes, and moves no joint (F-d)', async () => {
    let item: string | null = null
    const { def, options: o } = await options({ state: () => ({ moving: false, item }) })
    const view = figure(def, o)(row, 'hero', emptyModels)
    expect(calls.build).toBe(1)
    const spine = () => {
      const drawing = view?.container.children[0] as Container3D
      const joint = drawing.children[2] as Container3D
      return [joint.position.x, joint.position.y, joint.position.z]
    }
    const before = spine()
    view?.update?.(row.components)
    expect(calls.build).toBe(1)
    item = 'hand-lamp'
    view?.update?.(row.components)
    view?.update?.(row.components)
    expect(calls.build).toBe(2)
    expect(view?.container.children.length).toBe(1)
    expect(spine()).toEqual(before)
    view?.destroy?.()
  })

  it('tints each lit material by the room light at the chest, and keeps a flat one as it is (M3R-D4)', async () => {
    const light = createSceneLight(
      sceneLightingSchema.parse({
        ambient: 0.25,
        lamps: [{ id: 'lamp', x: 0, y: 2, z: 0, color: 0xff8040, strength: 2, range: 4 }],
      }),
    )
    const { def, options: o } = await options()
    const view = figure(def, o)(row, 'hero', emptyModels, light)
    view?.update?.({ hero: { x: 1, y: 0, z: 0.5, yaw: 0 } })
    const s = skeleton(def)
    const tint = light.tint(1, s.chestY, 0.5)
    // Every material Wick's parts and its neutral face's marks draw (its glowing eyes are flat).
    const built = build(def, s, def.default, null, o.library)
    const neutral = built.decals.filter(
      (d) => (d.when === undefined || d.when.includes('neutral')) && d.blink !== true,
    )
    const expected = new Set(
      [...built.parts, ...neutral].map(({ material }) => {
        const m = built.materials[material]
        if (m === undefined) throw new Error(`no material ${material}`)
        const colour = materialColour(m, DEFAULT_PALETTE.colors)
        return m.flat ? colour : tinted(channels(colour), tint)
      }),
    )
    const drawn = new Set<number>()
    const visit = (node: Container3D) => {
      if (node instanceof Mesh3D) drawn.add((node.material as FlatMaterial).baseColor)
      for (const child of node.children) if (child instanceof Container3D) visit(child)
    }
    visit(view?.container as Container3D)
    expect([...drawn].map((c) => c.toString(16)).sort()).toEqual(
      [...expected].map((c) => c.toString(16)).sort(),
    )
    view?.destroy?.()
  })

  it('warns once when building a figure takes longer than the budget', async () => {
    const warn = vi.fn()
    let ms = 0
    // Every reading of the build timer is a second later than the last.
    const { def, options: o } = await options({ warn, measure: () => (ms += 1000) })
    const make = figure(def, o)
    make(row, 'hero', emptyModels)?.destroy?.()
    make(row, 'hero', emptyModels)?.destroy?.()
    expect(FIGURE_BUILD_BUDGET_MS).toBe(5)
    expect(warn).toHaveBeenCalledTimes(1)
    expect(warn.mock.calls[0]?.[0]).toMatch(/figure .* took 1000 ms to build/)
  })
})
