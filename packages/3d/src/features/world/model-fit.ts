// Where a model goes so it stands on its blockout. A prop's generated parts are the blockout: they own its place, its turn,
// its footprint and its height, and a model replaces them on screen. The fit is a rule of the box, not of the model, so
// swapping one model for another never moves a collider:
//   - the model is turned with the blockout (`turn`, and `fit.turn` beyond it for a model whose front is not the blockout's);
//   - its scale is the largest uniform one that keeps it inside the box on every axis, never a stretch (`fit.scale` replaces it);
//   - it rests on the box's base and is centred on its footprint, and `fit.offset` moves it from there.
// A model's own origin does not matter: only its bounds do.

import type { PropFit } from '../../shared/level/af-sector-2.schema.ts'
import type { V3 } from '../../shared/math/math.ts'

/** A blockout: the box its generated parts fill on the plan (turned already) and the turn that made it, in degrees. */
export interface Blockout {
  readonly min: V3
  readonly max: V3
  readonly turn: number
}

/** A model's own bounds, as its file gives them. */
export interface ModelBounds {
  readonly min: readonly [number, number, number]
  readonly max: readonly [number, number, number]
}

/** What takes a model's own points to the world's: scale, then turn about up, then move. */
export interface ModelFit {
  readonly scale: number
  /** Degrees about up, the builder's way (`rotateY`). */
  readonly turn: number
  readonly position: V3
}

/** A point of the model's space in the world. */
export function fitPoint(fit: ModelFit, point: readonly [number, number, number]): V3 {
  const c = Math.cos((fit.turn * Math.PI) / 180)
  const s = Math.sin((fit.turn * Math.PI) / 180)
  const [x, y, z] = [point[0] * fit.scale, point[1] * fit.scale, point[2] * fit.scale]
  return [c * x + s * z + fit.position[0], y + fit.position[1], -s * x + c * z + fit.position[2]]
}

/** The model's corners turned by `degrees` and their box: its size, and its lowest point and middle on the plan. */
function turned(model: ModelBounds, degrees: number) {
  const c = Math.cos((degrees * Math.PI) / 180)
  const s = Math.sin((degrees * Math.PI) / 180)
  const low = [Infinity, Infinity, Infinity]
  const high = [-Infinity, -Infinity, -Infinity]
  for (const x of [model.min[0], model.max[0]])
    for (const y of [model.min[1], model.max[1]])
      for (const z of [model.min[2], model.max[2]]) {
        const corner = [c * x + s * z, y, -s * x + c * z]
        for (const axis of [0, 1, 2]) {
          low[axis] = Math.min(low[axis] as number, corner[axis] as number)
          high[axis] = Math.max(high[axis] as number, corner[axis] as number)
        }
      }
  return { low: low as unknown as V3, high: high as unknown as V3 }
}

/**
 * The fit of `model` to `blockout`. Throws when the model has no size on any axis, since nothing of it can be seen.
 */
export function fitModel(blockout: Blockout, model: ModelBounds, fit: PropFit = {}): ModelFit {
  const turn = blockout.turn + (fit.turn ?? 0)
  const { low, high } = turned(model, turn)
  // An axis the model has no extent on (a flat sheet's thickness) puts no limit on the scale.
  const ratios = [0, 1, 2].flatMap((axis) => {
    const size = (high[axis] as number) - (low[axis] as number)
    return size > 0 ? [((blockout.max[axis] as number) - (blockout.min[axis] as number)) / size] : []
  })
  if (ratios.length === 0) throw new Error('the model has no size, so it cannot be fitted to a blockout')
  const scale = fit.scale ?? Math.min(...ratios)
  const [ox, oy, oz] = fit.offset ?? [0, 0, 0]
  return {
    scale,
    turn,
    position: [
      (blockout.min[0] + blockout.max[0]) / 2 - (scale * ((low[0] as number) + (high[0] as number))) / 2 + ox,
      blockout.min[1] - scale * (low[1] as number) + oy,
      (blockout.min[2] + blockout.max[2]) / 2 - (scale * ((low[2] as number) + (high[2] as number))) / 2 + oz,
    ],
  }
}
