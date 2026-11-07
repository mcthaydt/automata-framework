// H5, the fabrics: a garment's cloth carries a tiled weave or pattern. A fabric is data, a tile of tone labels (one per
// texel), and a swatch names it. A label shifts a tiled texel's tone within its own ramp (+1 a step lighter, -1 a step
// darker), so a tile never moves a texel off its ramp. The base registers none, so no base pixel moves.
//
// Two kinds of tile, by size: a motif (4 x 4 or smaller) is how a pixel artist draws a weave (denim's twill as a one-step
// diagonal hatch), one step deep, labels 0 or -1; a pattern (anything larger: a check, a plaid) may use -2 to +1.
//
// Ported from FigureBuilder (mcthaydt/FigureBuilder) src/features/paint/fabric.ts at 025ffb4 (`Fabric`,
// `registerFabric`, `fabricOf`, `labelAt`), with AF's strict types. The painter that reads the labels is not taken.

import { RegistryClash } from '../../../shared/registry/registry-clash.ts'

export interface Fabric {
  /** Tile size in labels, and the labels row by row (w x h), each a tone offset: +1 a step lighter, -1 a step darker. */
  readonly w: number
  readonly h: number
  readonly labels: readonly number[]
  /** Metres per label: the pattern keeps its physical size (a check of a set width). Left out: one label per texel. */
  readonly metres?: number
}

const FABRICS = new Map<string, Fabric>()

/** Registers a fabric under a name. Throws on a taken name or a bad tile. */
export function registerFabric(name: string, f: Fabric): void {
  if (FABRICS.has(name)) throw new RegistryClash('fabric', name)
  if (!Number.isInteger(f.w) || !Number.isInteger(f.h) || f.w < 1 || f.h < 1)
    throw new RangeError(`fabric ${name}: w and h must be whole numbers from 1`)
  if (f.labels.length !== f.w * f.h)
    throw new RangeError(`fabric ${name}: ${f.labels.length} labels for a ${f.w}×${f.h} tile`)
  if (f.labels.some((l) => !Number.isInteger(l)))
    throw new RangeError(`fabric ${name}: labels must be whole numbers`)
  if (f.metres !== undefined && !(f.metres > 0))
    throw new RangeError(`fabric ${name}: metres must be above 0`)
  const motif = f.w <= 4 && f.h <= 4
  if (motif && f.labels.some((l) => l !== 0 && l !== -1))
    throw new RangeError(`fabric ${name}: a motif (4×4 or smaller) is one step deep, labels 0 or -1`)
  if (!motif && f.labels.some((l) => l < -2 || l > 1))
    throw new RangeError(`fabric ${name}: a pattern's labels run -2 to +1`)
  FABRICS.set(name, { ...f, labels: [...f.labels] })
}

/** The fabric of a name, or undefined. */
export const fabricOf = (name: string): Fabric | undefined => FABRICS.get(name)

const mod = (n: number, m: number): number => ((n % m) + m) % m

/** The label at (u, v) metres on the cloth. `ppm` (texels per metre) sets the tile's size unless it keeps `metres`. */
export function labelAt(f: Fabric, u: number, v: number, ppm: number): number {
  const q = f.metres ? 1 / f.metres : ppm
  return f.labels[mod(Math.floor(v * q), f.h) * f.w + mod(Math.floor(u * q), f.w)] ?? 0
}
