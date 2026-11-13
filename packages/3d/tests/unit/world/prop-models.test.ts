// A prop's blockout and the model fitted to it: the builder keeps each placed prop's box (the model's brief and the
// collider's), and `fitModel` says where a model goes so it stays inside that box.
import { describe, expect, it } from 'vitest'
import { buildWorld } from '#src/features/world/build.ts'
import { fitModel, fitPoint } from '#src/features/world/model-fit.ts'
import type { AfSector2 } from '#src/shared/level/af-sector-2.schema.ts'
import type { V3 } from '#src/shared/math/math.ts'

const level = (props: AfSector2['props']): AfSector2 => ({
  format: 'af-sector/2',
  name: 't',
  sectors: [
    {
      id: 'a',
      floor: { z: 0 },
      ceiling: { z: 3 },
      light: 1,
      corners: [
        [0, 0],
        [6, 0],
        [6, 6],
        [0, 6],
      ],
    },
  ],
  ...(props === undefined ? {} : { props }),
})
const LIBRARY = { swatches: { oakFloor: {}, plasterWarm: {}, wood: {} } }

describe('the world’s props', () => {
  it('keeps each placed prop’s blockout box, turned with it, and the model it names', () => {
    const world = buildWorld(
      level([
        {
          id: 'chest',
          at: [2, 3],
          kind: 'box',
          with: { size: [1, 0.5, 0.6], swatch: 'wood' },
          angle: 0,
          model: 'm.bin',
        },
      ]),
      LIBRARY,
    )
    const [chest] = world.props
    expect(chest).toMatchObject({ id: 'chest', sector: 'a', model: 'm.bin', turn: 90 })
    expect(chest?.at).toEqual([2, 0, 3])
    // Angle 0 turns the box a quarter, so its 1 m side runs down the plan: 0.6 across and 1 deep, about (2, 3).
    const sides: [V3 | undefined, number[]][] = [
      [chest?.min, [1.7, 0, 2.5]],
      [chest?.max, [2.3, 0.5, 3.5]],
    ]
    for (const [got, want] of sides)
      for (const axis of [0, 1, 2]) expect((got as V3)[axis]).toBeCloseTo(want[axis] as number, 5)
  })

  it('lists a prop with no model too, for its footprint, and carries the fit as written', () => {
    const world = buildWorld(
      level([
        { id: 'plain', at: [1, 1], kind: 'box', with: { swatch: 'wood' } },
        {
          id: 'fitted',
          at: [4, 4],
          kind: 'box',
          with: { swatch: 'wood' },
          model: 'm.bin',
          fit: { scale: 0.5 },
        },
      ]),
      LIBRARY,
    )
    expect(world.props.map((prop) => prop.id)).toEqual(['plain', 'fitted'])
    expect(world.props[0]).not.toHaveProperty('model')
    expect(world.props[1]?.fit).toEqual({ scale: 0.5 })
  })

  it('draws a level with a model exactly as one without: the blockout’s pieces are the same', () => {
    const props = [{ id: 'chest', at: [2, 3] as const, kind: 'box', with: { swatch: 'wood' } }]
    const plain = buildWorld(level(props.map((prop) => ({ ...prop, at: [...prop.at] }))), LIBRARY)
    const named = buildWorld(
      level(props.map((prop) => ({ ...prop, at: [...prop.at], model: 'm.bin' }))),
      LIBRARY,
    )
    expect(named.pieces).toEqual(plain.pieces)
    expect(named.lamps).toEqual(plain.lamps)
  })

  it('leaves out a prop the library cannot build, since it has no blockout to fit', () => {
    const world = buildWorld(
      level([{ id: 'ghost', at: [1, 1], use: 'nothing.here', model: 'm.bin' }]),
      LIBRARY,
    )
    expect(world.props).toEqual([])
    expect(world.problems.map((problem) => problem.code)).toContain('unknown-prop')
  })
})

/** A box on the plan: the blockout's bounds and turn. */
const blockout = (min: V3, max: V3, turn = 0) => ({ min, max, turn })
/** The corners of the model's box, fitted, as a bounds pair. */
function fitted(fit: ReturnType<typeof fitModel>, min: V3, max: V3): { low: V3; high: V3 } {
  const corners = [0, 1].flatMap((x) =>
    [0, 1].flatMap((y) =>
      [0, 1].map((z) => fitPoint(fit, [x ? max[0] : min[0], y ? max[1] : min[1], z ? max[2] : min[2]])),
    ),
  )
  return {
    low: [0, 1, 2].map((axis) => Math.min(...corners.map((c) => c[axis] as number))) as unknown as V3,
    high: [0, 1, 2].map((axis) => Math.max(...corners.map((c) => c[axis] as number))) as unknown as V3,
  }
}
const near = (got: V3, want: V3): void => {
  for (const axis of [0, 1, 2]) expect(got[axis]).toBeCloseTo(want[axis] as number, 5)
}

describe('fitModel', () => {
  const tall = { min: [-0.5, 0, -0.5] as V3, max: [0.5, 2, 0.5] as V3 }

  it('scales a model uniformly to the tightest axis of the box, rests it on the base and centres it', () => {
    const fit = fitModel(blockout([0, 0, 0], [1, 1, 1]), tall)
    expect(fit.scale).toBeCloseTo(0.5)
    const { low, high } = fitted(fit, tall.min, tall.max)
    near(low, [0.25, 0, 0.25])
    near(high, [0.75, 1, 0.75])
  })

  it('does not stretch: a wide model in a square box is limited by its width, and rests on the base', () => {
    const wide = { min: [-1, 0, -0.5] as V3, max: [1, 1, 0.5] as V3 }
    const fit = fitModel(blockout([0, 0, 0], [1, 1, 1]), wide)
    expect(fit.scale).toBeCloseTo(0.5)
    const { low, high } = fitted(fit, wide.min, wide.max)
    near(low, [0, 0, 0.25])
    near(high, [1, 0.5, 0.75])
  })

  it('rests on the box’s base wherever the model’s own origin is', () => {
    const lifted = { min: [0, 0.5, 0] as V3, max: [1, 1.5, 1] as V3 }
    const { low } = fitted(fitModel(blockout([4, 2, 4], [5, 3, 5]), lifted), lifted.min, lifted.max)
    expect(low[1]).toBeCloseTo(2)
  })

  it('turns with the blockout, so a model long in x fills a box long in z', () => {
    const long = { min: [-1, 0, -0.5] as V3, max: [1, 1, 0.5] as V3 }
    const fit = fitModel(blockout([0, 0, 0], [1, 1, 2], 90), long)
    expect(fit.scale).toBeCloseTo(1)
    const { low, high } = fitted(fit, long.min, long.max)
    near(low, [0, 0, 0])
    near(high, [1, 1, 2])
  })

  it('stays inside the box at a turn that is not a quarter', () => {
    const { low, high } = fitted(fitModel(blockout([0, 0, 0], [1, 1, 1], 40), tall), tall.min, tall.max)
    for (const axis of [0, 1, 2]) {
      expect(low[axis]).toBeGreaterThanOrEqual(-1e-9)
      expect(high[axis]).toBeLessThanOrEqual(1 + 1e-9)
    }
  })

  it('takes a scale, an offset and a further turn from the fit when the prop gives them', () => {
    const base = blockout([0, 0, 0], [1, 1, 1])
    expect(fitModel(base, tall, { scale: 0.25 }).scale).toBe(0.25)
    const { low } = fitted(fitModel(base, tall, { offset: [1, 0.5, -1] }), tall.min, tall.max)
    near(low, [1.25, 0.5, -0.75])
    expect(fitModel(base, tall, { turn: 90 }).turn).toBe(90)
  })

  it('throws for a model with no size at all, since there is nothing to fit', () => {
    expect(() => fitModel(blockout([0, 0, 0], [1, 1, 1]), { min: [1, 1, 1], max: [1, 1, 1] })).toThrow(/size/)
  })

  it('fits a flat sheet by the axes it has', () => {
    const sheet = { min: [0, 0, 0] as V3, max: [2, 0, 1] as V3 }
    expect(fitModel(blockout([0, 0, 0], [1, 1, 1]), sheet).scale).toBeCloseTo(0.5)
  })
})
