// Smooth deterministic value noise, for lumpy foliage and rocks and for a lamp's flicker.

/** One lattice point's value in [0, 1): an integer hash. */
function lattice(x: number, y: number, z: number): number {
  let n = Math.imul(x, 0x27d4eb2d) ^ Math.imul(y, 0x165667b1) ^ Math.imul(z, 0x9e3779b1)
  n = Math.imul(n ^ (n >>> 15), 0x85ebca6b)
  n ^= n >>> 13
  return (n >>> 0) / 4294967296
}

/** Smooth 3D value noise in [0, 1), deterministic: the hash at the lattice's corners, smoothstep-blended. */
export function noise3(x: number, y: number, z: number): number {
  const x0 = Math.floor(x)
  const y0 = Math.floor(y)
  const z0 = Math.floor(z)
  const fx = x - x0
  const fy = y - y0
  const fz = z - z0
  const u = fx * fx * (3 - 2 * fx)
  const v = fy * fy * (3 - 2 * fy)
  const w = fz * fz * (3 - 2 * fz)
  const at = (i: number, j: number, k: number): number => lattice(x0 + i, y0 + j, z0 + k)
  const x00 = at(0, 0, 0) + (at(1, 0, 0) - at(0, 0, 0)) * u
  const x10 = at(0, 1, 0) + (at(1, 1, 0) - at(0, 1, 0)) * u
  const x01 = at(0, 0, 1) + (at(1, 0, 1) - at(0, 0, 1)) * u
  const x11 = at(0, 1, 1) + (at(1, 1, 1) - at(0, 1, 1)) * u
  const y0v = x00 + (x10 - x00) * v
  const y1v = x01 + (x11 - x01) * v
  return y0v + (y1v - y0v) * w
}
