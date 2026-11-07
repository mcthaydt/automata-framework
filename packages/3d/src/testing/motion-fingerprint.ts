// A world pose's fingerprint, for the FigureBuilder motion goldens (tests/fixtures/__goldens__/figurebuilder-motion.json).
// The same function runs in the motion tests on AF's world matrices and in scripts/figurebuilder-motion-goldens.ts
// on FigureBuilder's, so it imports nothing (the script loads it with Node's type stripping).
//
// Each joint keeps its whole transform: its position and its rotation as a unit quaternion (w ≥ 0), seven numbers
// for twelve that carry six degrees of freedom, so no change to a joint passes unseen.

/** Per joint: [x, y, z, qx, qy, qz, qw]. */
export type MotionFingerprint = number[][]

/** The fingerprint of a list of affine matrices (row-major 3x3 rotation, then the translation). */
export function motionFingerprint(world: readonly (readonly number[])[]): MotionFingerprint {
  return world.map((m) => {
    const [a = 0, b = 0, c = 0, d = 0, e = 0, f = 0, g = 0, h = 0, i = 0, x = 0, y = 0, z = 0] = m
    // Shepperd's method: the largest of the four squared components first, for precision.
    const t = a + e + i
    let q: [number, number, number, number]
    if (t > 0) {
      const s = Math.sqrt(t + 1) * 2
      q = [(h - f) / s, (c - g) / s, (d - b) / s, s / 4]
    } else if (a > e && a > i) {
      const s = Math.sqrt(1 + a - e - i) * 2
      q = [s / 4, (b + d) / s, (c + g) / s, (h - f) / s]
    } else if (e > i) {
      const s = Math.sqrt(1 + e - a - i) * 2
      q = [(b + d) / s, s / 4, (f + h) / s, (c - g) / s]
    } else {
      const s = Math.sqrt(1 + i - a - e) * 2
      q = [(c + g) / s, (f + h) / s, s / 4, (d - b) / s]
    }
    const sign = q[3] < 0 ? -1 : 1
    return [x, y, z, sign * q[0], sign * q[1], sign * q[2], sign * q[3]]
  })
}
