// The two generators core ships: a box and a cylinder, each one swatch, a size and its origin at the base centre. A
// game's own props are presets of these (`{ kind = "box", swatch = "wood", size = [1, 0.5, 0.6] }`); any other shape
// is a generator an extension registers (`registerPropGenerator`).
import { box, cylinder } from '../mesh.ts'
import { type Built, type Generator, part } from './piece.ts'

/** A box: `size` `[width, height, depth]` in metres, painted `swatch`. */
const boxProp: Generator = (p) => {
  const [w, h, d] = (p.size as [number, number, number] | undefined) ?? [0.5, 0.5, 0.5]
  return {
    pieces: [part(box([0, 0, 0], [w, h, d]), String(p.swatch), 'body')],
    top: { y: h, size: [w, d] },
  } satisfies Built
}

/** An upright cylinder: `radius` and `height` in metres, painted `swatch`. */
const cylinderProp: Generator = (p) => {
  const r = (p.radius as number | undefined) ?? 0.25
  const h = (p.height as number | undefined) ?? 0.5
  return {
    pieces: [part(cylinder([0, 0, 0], r, h), String(p.swatch), 'body')],
    top: { y: h, size: [r * 1.4, r * 1.4] },
  } satisfies Built
}

/** The kinds core registers itself. */
export const PRIMITIVE_PROPS: Readonly<Record<string, Generator>> = {
  box: boxProp,
  cylinder: cylinderProp,
}
