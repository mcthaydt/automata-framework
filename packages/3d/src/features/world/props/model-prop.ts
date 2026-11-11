// The `model` prop: a GLB placed as a prop. The builder knows no renderer and reads no file, so the prop is a stand-in box
// of the fitted size (what shows where the model is not loaded, and what the light and the camera see) that names the
// model; the renderer fits the loaded model to it (`fitModelMesh`). `size` is the box in the prop's own space, `uniform`
// fits the model by its height alone, `mirror` flips it along x, `gain` brightens a dark texture, `wall` hangs it on a
// wall (the wall's camera-cut group) and `ceiling` hangs it from the ceiling.
import { box } from '../mesh.ts'
import type { Generator, ModelSpec } from './piece.ts'
import { part } from './piece.ts'

const DEFAULT_SIZE = [0.5, 0.5, 0.5] as const

/** A model: its stand-in box, painted `swatch`, carrying the model's name when it has one. */
export const modelProp: Generator = (p) => {
  const size = (p.size as [number, number, number] | undefined) ?? [...DEFAULT_SIZE]
  const file = typeof p.model === 'string' ? p.model : undefined
  const model: ModelSpec | undefined =
    file === undefined
      ? undefined
      : {
          file,
          size,
          uniform: p.uniform === true,
          mirror: p.mirror === true,
          gain: typeof p.gain === 'number' ? p.gain : 1,
        }
  return {
    pieces: [
      part(box([0, 0, 0], size), String(p.swatch ?? 'basePrim'), 'model', {
        ...(model === undefined ? {} : { model }),
        ...(typeof p.wall === 'string' ? { cut: p.wall } : {}),
        ...(p.ceiling === true ? { ceiling: true } : {}),
      }),
    ],
    top: { y: size[1], size: [size[0], size[2]] },
  }
}
