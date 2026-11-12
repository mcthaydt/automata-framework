import { describe, expect, it } from 'vitest'
import { modelBounds, placeModels } from '../../../tools/convert/models.ts'
import type { PlacedModel } from '../../../tools/convert/props-table.ts'

// The old furniture's models, placed on the blockouts: each prop of the level names its old model and the turn that brings the
// model to the old yaw; a blockout that is not the old box is replaced by that box, so the model has the size, the place and the
// turn to be fitted to.

/** A model 1 m wide, 2 m tall and 0.5 m deep, with its origin at its middle. */
const BOUNDS = { min: [-0.5, -1, -0.25], max: [0.5, 1, 0.25] } as const
const bounds = () => BOUNDS

const level = (props: unknown[]) => ({ format: 'af-sector/2', name: 't', sectors: [], props })
const model = (over: Partial<PlacedModel> = {}): PlacedModel => ({
  file: 'cupboard',
  x: 2,
  z: 3,
  size: [1, 2, 0.5],
  ...over,
})
const propsOf = (placed: unknown): Record<string, unknown>[] =>
  (placed as { props: Record<string, unknown>[] }).props

describe('placeModels', () => {
  it('names the model of each prop, by the file the old game used', () => {
    const [prop] = propsOf(
      placeModels(level([{ id: 'cupboard', at: [2, 3], use: 'cabinet' }]), [model()], { bounds }),
    )
    expect(prop).toMatchObject({ id: 'cupboard', use: 'cabinet', model: 'models/cupboard.bin' })
  })

  it('adds the turn that brings the model to the old yaw when the blockout is turned another way', () => {
    // The old yaw is 90 degrees; the blockout is turned by 90 - angle = -90.
    const [prop] = propsOf(
      placeModels(
        level([{ id: 'cupboard', at: [2, 3], use: 'cabinet', angle: 180 }]),
        [model({ yaw: Math.PI / 2 })],
        { bounds },
      ),
    )
    expect(prop?.fit).toEqual({ turn: 180 })
  })

  it('writes no fit for a model already turned as the blockout is', () => {
    const [prop] = propsOf(
      placeModels(level([{ id: 'cupboard', at: [2, 3], use: 'cabinet' }]), [model()], { bounds }),
    )
    expect(prop).not.toHaveProperty('fit')
  })

  it('replaces a blockout that is not the old box with a box of the old size, in the old place, turned by the old yaw', () => {
    const [prop] = propsOf(
      placeModels(
        level([{ id: 'cupboard', at: [2, 3], use: 'cabinet' }]),
        [model({ yaw: Math.PI / 2, y: 1.2 })],
        {
          bounds,
          boxed: new Set(['cupboard']),
        },
      ),
    )
    expect(prop).toMatchObject({
      id: 'cupboard',
      kind: 'box',
      at: [2, 3, 1.2],
      model: 'models/cupboard.bin',
      fit: { turn: 90 },
    })
    expect(prop).not.toHaveProperty('use')
    expect(prop).not.toHaveProperty('angle')
    // A model 1 by 2 by 0.5 stood to 2 m is 1 by 2 by 0.5; turned a quarter it takes 0.5 across and 1 deep.
    expect(
      ((prop as Record<string, unknown>).with as { size: number[] }).size.map(
        (n) => Math.round(n * 1000) / 1000,
      ),
    ).toEqual([0.5, 2, 1])
  })

  it('stretches nothing: a model fitted to a height of 1 m is half its size, and the box is that', () => {
    const [prop] = propsOf(
      placeModels(level([]), [model({ size: [9, 1, 9] })], { bounds, boxed: new Set(['cupboard']) }),
    )
    expect(((prop as Record<string, unknown>).with as { size: number[] }).size).toEqual([0.5, 1, 0.25])
  })

  it('adds a prop the level lacks (a chair on its side) as a box, so it has a blockout', () => {
    const placed = propsOf(placeModels(level([]), [model({ file: 'fallen-chair' })], { bounds }))
    expect(placed.map((prop) => prop.id)).toEqual(['fallen-chair'])
    expect(placed[0]).toMatchObject({ kind: 'box', model: 'models/fallen-chair.bin' })
  })

  it('numbers a model that stands more than once as the converter does', () => {
    const placed = propsOf(
      placeModels(
        level([
          { id: 'cupboard-1', at: [2, 3], use: 'cabinet' },
          { id: 'cupboard-2', at: [5, 3], use: 'cabinet' },
        ]),
        [model(), model({ x: 5 })],
        { bounds },
      ),
    )
    expect(placed.map((prop) => prop.model)).toEqual(['models/cupboard.bin', 'models/cupboard.bin'])
  })

  it('gives a model the level has no prop for a box whether or not it was asked for one', () => {
    expect(propsOf(placeModels(level([]), [model()], { bounds }))).toHaveLength(1)
  })
})

describe('a prop that keeps its blockout', () => {
  it('has its model at the old scale and moved by the offset it is given, so it leaves the blockout by that', () => {
    const [prop] = propsOf(
      placeModels(level([{ id: 'cupboard', at: [2, 3], use: 'lamp' }]), [model({ size: [1, 1, 0.25] })], {
        bounds,
        keep: { cupboard: { offset: [0, -0.18, 0] } },
      }),
    )
    expect(prop).toMatchObject({
      use: 'lamp',
      model: 'models/cupboard.bin',
      fit: { scale: 0.5, offset: [0, -0.18, 0] },
    })
  })
})

describe('a model whose long side the old game stretched across the other', () => {
  it('takes the turn it is given in place of the old yaw’s, so its long side lies along the blockout’s', () => {
    const [prop] = propsOf(
      placeModels(
        level([{ id: 'cupboard', at: [2, 3], kind: 'box', angle: 0 }]),
        [model({ yaw: Math.PI / 2 })],
        {
          bounds,
          turned: { cupboard: -90 },
        },
      ),
    )
    expect(prop?.fit).toEqual({ turn: -90 })
  })
})

describe('modelBounds', () => {
  it('reads the bounds from the pack header', () => {
    const buffer = new ArrayBuffer(56)
    const view = new DataView(buffer)
    view.setUint32(0, 0x3150_4c4c, true)
    for (const [i, n] of [-0.5, 0, -0.25, 0.5, 1.8, 0.25].entries()) view.setFloat32(16 + i * 4, n, true)
    const got = modelBounds(new Uint8Array(buffer))
    expect(got.min).toEqual([-0.5, 0, -0.25])
    expect(got.max[1]).toBeCloseTo(1.8, 5)
  })
})
