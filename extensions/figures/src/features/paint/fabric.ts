/**
 * H5, the fabric registry: a garment's cloth carries a tiled weave or pattern. A fabric is data, a tile of tone labels
 * (one per texel), and a material names it (`Material.fabric`). The painter shifts each tiled texel's tone within that
 * material's own ramp by the tile's label (+1 a step lighter, −1 a step darker), so a tile never moves a texel off its
 * ramp. Base registers none, so no base pixel moves.
 *
 * Two kinds of tile, by size:
 * - a **motif** (`w ≤ 4 && h ≤ 4`) is a painting technique, how a pixel artist draws a weave (denim's twill as a
 *   one-step diagonal hatch, a rib as alternating columns), not a picture of a material. It stays one step deep: labels
 *   0 or −1, so the key's bands stay crisp under it;
 * - a **pattern** (anything larger: a check, a plaid, a photographed tile a fork converts to JSON) may use −2…+1.
 *
 * A fork writes `{ "<name>": { w, h, labels, metres? } }` JSON and calls `registerFabric` for each entry at load.
 */
export interface Fabric {
  /** Tile size in labels, and the labels row by row (w·h), each a tone offset: +1 a step lighter, −1 a step darker. */
  w: number; h: number; labels: number[];
  /** Metres per label: the pattern keeps its physical size (a check of a set width). Left out: one label per texel at
   * every density (the default). */
  metres?: number;
}
const FABRICS = new Map<string, Fabric>();
/** Registers a fabric under a name. Throws on a taken name or a bad tile. */
export function registerFabric(name: string, f: Fabric): void {
  if (FABRICS.has(name)) throw new Error(`fabric ${name}: already registered`);
  if (!Number.isInteger(f.w) || !Number.isInteger(f.h) || f.w < 1 || f.h < 1) throw new Error(`fabric ${name}: w and h must be whole numbers from 1`);
  if (f.labels.length !== f.w * f.h) throw new Error(`fabric ${name}: ${f.labels.length} labels for a ${f.w}×${f.h} tile`);
  if (f.labels.some(l => !Number.isInteger(l))) throw new Error(`fabric ${name}: labels must be whole numbers`);
  if (f.metres !== undefined && !(f.metres > 0)) throw new Error(`fabric ${name}: metres must be above 0`);
  const motif = f.w <= 4 && f.h <= 4;
  if (motif && f.labels.some(l => l !== 0 && l !== -1)) throw new Error(`fabric ${name}: a motif (4×4 or smaller) is one step deep, labels 0 or -1`);
  if (!motif && f.labels.some(l => l < -2 || l > 1)) throw new Error(`fabric ${name}: a pattern's labels run -2 to +1`);
  FABRICS.set(name, { ...f, labels: [...f.labels] });
}
export const fabricOf = (name: string): Fabric | undefined => FABRICS.get(name);
const mod = (n: number, m: number) => ((n % m) + m) % m;
/** The label at (u, v) metres on the cloth. `ppm` (texels per metre) sets the tile's size unless it keeps `metres`. */
export function labelAt(f: Fabric, u: number, v: number, ppm: number): number {
  const q = f.metres ? 1 / f.metres : ppm;
  return f.labels[mod(Math.floor(v * q), f.h) * f.w + mod(Math.floor(u * q), f.w)];
}
