import type { RenderRow } from '@automata/sim'
import { Container3D } from '@pixi/3d'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { CellCache } from '#src/features/figures/cells/cell-cache.ts'
import { PaintQueue } from '#src/features/figures/cells/paint-queue.ts'
import type { EvaluateOptions, FigureState } from '#src/features/figures/clips/figure-state.ts'
import type { FigureLayer, LayerFigure } from '#src/features/figures/layer/figure-layer.ts'
import type { CellView } from '#src/features/figures/paint/soup.ts'
import {
  FIGURE_BUILD_BUDGET_MS,
  type FigureViewOptions,
  figure,
} from '#src/features/figures/view/figure-view.ts'
import { emptyModels } from '#src/shared/render/model/load-models.ts'
import { fixtureFigures } from '#src/testing/fixture-library.ts'
import { fixtureMotion } from '#src/testing/fixture-motion.ts'

// Count the figures package's evaluations and builds, keeping what they do, and record what each evaluation saw.
const calls = vi.hoisted(() => ({
  evaluate: 0,
  build: 0,
  seen: [] as { state: FigureState; time: number; options: EvaluateOptions | undefined }[],
}))
vi.mock('#src/features/figures/clips/evaluate.ts', async (original) => {
  const real = await original<typeof import('#src/features/figures/clips/evaluate.ts')>()
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
vi.mock('#src/features/figures/figure/build.ts', async (original) => {
  const real = await original<typeof import('#src/features/figures/figure/build.ts')>()
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

/** A layer that only remembers the figures added to it. */
function fakeLayer(): { layer: FigureLayer; figures: LayerFigure[]; removed: () => number } {
  const figures: LayerFigure[] = []
  let removed = 0
  const layer = {
    add(f: LayerFigure) {
      figures.push(f)
      return () => {
        removed++
      }
    },
  } as unknown as FigureLayer
  return { layer, figures, removed: () => removed }
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
    const view = figure(def, o)(row, 'hero', emptyModels, undefined, { figures: fakeLayer().layer })
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

  it('builds and paints the figure again once when the outfit or the item changes', async () => {
    let item: string | null = null
    const { def, options: o } = await options({ state: () => ({ moving: false, item }) })
    const view = figure(def, o)(row, 'hero', emptyModels)
    expect(calls.build).toBe(1)
    view?.update?.(row.components)
    expect(calls.build).toBe(1)
    item = 'hand-lamp'
    view?.update?.(row.components)
    view?.update?.(row.components)
    expect(calls.build).toBe(2)
    // The figure is a painted cell: the view holds no mesh.
    expect(view?.container.children.length).toBe(0)
    view?.destroy?.()
  })

  it('shows the last cell while the one a view wants is painted, so a turn never leaves it undrawn', async () => {
    const { def, options: o } = await options()
    const { layer, figures } = fakeLayer()
    const view = figure(def, o)(row, 'hero', emptyModels, undefined, { figures: layer })
    const f = figures[0] as LayerFigure
    const cache = new CellCache(1e9)
    const queue = new PaintQueue()
    const front: CellView = { yaw: 0, pitch: 0.4, density: 1 }
    // Nothing yet: the cell waits to be painted.
    expect(f.cell(front, cache, queue, 0)).toBeUndefined()
    expect(queue.pending).toBe(1)
    queue.runOne()
    const first = f.cell(front, cache, queue, 0)
    expect(first?.cell.width).toBe(64)
    // A turn to the next direction is not there yet: the figure keeps the cell it had.
    const turned: CellView = { ...front, yaw: Math.PI / 4 }
    expect(f.cell(turned, cache, queue, 0)).toEqual(first)
    queue.runOne()
    const second = f.cell(turned, cache, queue, 0)
    expect(second?.key).not.toBe(first?.key)
    expect(second?.cell).not.toBe(first?.cell)
    view?.destroy?.()
  })

  it('paints a cell from the pose held, with the view’s sprite cheats, and a changed pose is another cell', async () => {
    let moving = false
    const { def, clock, options: o } = await options({ state: () => ({ moving }) })
    const { layer, figures } = fakeLayer()
    const view = figure(def, o)(row, 'hero', emptyModels, undefined, { figures: layer })
    const f = figures[0] as LayerFigure
    const cache = new CellCache(1e9)
    const queue = new PaintQueue()
    const want: CellView = { yaw: 0, pitch: 0.4, density: 1 }
    const posedAt = calls.evaluate
    f.cell(want, cache, queue, 0)
    queue.runOne()
    expect(calls.evaluate).toBe(posedAt + 1)
    const painted = calls.seen[calls.seen.length - 1]
    expect(painted?.options?.sprite).toBeDefined()
    expect(painted?.state.moving).toBe(false)
    const standing = f.cell(want, cache, queue, 0)
    moving = true
    clock.set(1)
    view?.update?.(row.components)
    expect(f.cell(want, cache, queue, 0)?.key).toBe(standing?.key)
    queue.runOne()
    expect(f.cell(want, cache, queue, 0)?.key).not.toBe(standing?.key)
    view?.destroy?.()
  })

  it('takes the figure out of the layer when it is destroyed, and tells where it stands and faces', async () => {
    const { def, options: o } = await options()
    const { layer, figures, removed } = fakeLayer()
    const view = figure(def, o)(
      { sid: 1, components: { hero: { x: 2, y: 1, z: 3, yaw: 0.5 } } },
      'hero',
      emptyModels,
      undefined,
      { figures: layer },
    )
    expect(figures[0]?.place()).toEqual({ at: [2, 1, 3], yaw: 0.5 })
    view?.destroy?.()
    expect(removed()).toBe(1)
  })

  it('says once that a figure is not drawn when the renderer has no figure layer', async () => {
    const warn = vi.fn()
    const { def, options: o } = await options({ warn, measure: () => 0 })
    const make = figure(def, o)
    make(row, 'hero', emptyModels)?.destroy?.()
    make(row, 'hero', emptyModels)?.destroy?.()
    expect(warn).toHaveBeenCalledTimes(1)
    expect(warn.mock.calls[0]?.[0]).toMatch(/no figure layer/)
  })

  it('warns once when building a figure takes longer than the budget', async () => {
    const warn = vi.fn()
    let ms = 0
    // Every reading of the build timer is a second later than the last.
    const { def, options: o } = await options({ warn, measure: () => (ms += 1000) })
    const make = figure(def, o)
    make(row, 'hero', emptyModels, undefined, { figures: fakeLayer().layer })?.destroy?.()
    make(row, 'hero', emptyModels, undefined, { figures: fakeLayer().layer })?.destroy?.()
    expect(FIGURE_BUILD_BUDGET_MS).toBe(5)
    expect(warn).toHaveBeenCalledTimes(1)
    expect(warn.mock.calls[0]?.[0]).toMatch(/figure .* took 1000 ms to build/)
  })
})
