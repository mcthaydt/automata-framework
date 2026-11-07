// A part's geometry fingerprint, for the FigureBuilder goldens (tests/fixtures/__goldens__/figurebuilder-dress.json).
// The same function runs in build.test.ts on AF's parts and in scripts/figurebuilder-goldens.ts on
// FigureBuilder's, so it imports nothing (the script loads it with Node's type stripping).
//
// First moments alone miss a uniform scale or a radius change on a symmetric part (the sums stay near the
// centre's), so each of positions and normals also has its second moments (Σx², Σy², Σz², Σxy) and an
// order-sensitive sum (Σ (k + 1)·p_k per axis, k the vertex), and the skin its weighted bone sum.

/** The part fields a fingerprint reads (AF's Part and FigureBuilder's Part both have them). */
export interface Fingerprinted {
  readonly mesh: {
    readonly positions: readonly number[]
    readonly normals: readonly number[]
    readonly indices: readonly number[]
  }
  readonly bone?: number | undefined
  readonly group: number
  readonly skin?: readonly (readonly (readonly [number, number])[])[] | undefined
}

/** Sums of a flat x, y, z list: [Σx, Σy, Σz], [Σx², Σy², Σz², Σxy] and [Σ(k+1)x, Σ(k+1)y, Σ(k+1)z]. */
export interface Moments {
  readonly sum: number[]
  readonly second: number[]
  readonly ordered: number[]
}

export interface Fingerprint {
  readonly bone: number
  readonly group: number
  readonly v: number
  readonly i: number
  readonly isum: number
  readonly positions: Moments
  readonly normals: Moments
  /** Σ (bone + 1)·weight, and Σ (k + 1)(bone + 1)·weight over the vertices k. */
  readonly w: number
  readonly wOrdered: number
}

function moments(list: readonly number[]): Moments {
  const sum = [0, 0, 0]
  const second = [0, 0, 0, 0]
  const ordered = [0, 0, 0]
  for (let k = 0; k < list.length / 3; k++) {
    const x = list[k * 3] ?? Number.NaN
    const y = list[k * 3 + 1] ?? Number.NaN
    const z = list[k * 3 + 2] ?? Number.NaN
    const xyz = [x, y, z]
    for (let c = 0; c < 3; c++) {
      const value = xyz[c] ?? Number.NaN
      sum[c] = (sum[c] ?? 0) + value
      second[c] = (second[c] ?? 0) + value * value
      ordered[c] = (ordered[c] ?? 0) + (k + 1) * value
    }
    second[3] = (second[3] ?? 0) + x * y
  }
  return { sum, second, ordered }
}

export function fingerprint(p: Fingerprinted): Fingerprint {
  let w = 0
  let wOrdered = 0
  ;(p.skin ?? []).forEach((pairs, k) => {
    for (const [bone, x] of pairs) {
      w += (bone + 1) * x
      wOrdered += (k + 1) * (bone + 1) * x
    }
  })
  let isum = 0
  for (const i of p.mesh.indices) isum += i
  return {
    bone: p.bone ?? -1,
    group: p.group,
    v: p.mesh.positions.length / 3,
    i: p.mesh.indices.length,
    isum,
    positions: moments(p.mesh.positions),
    normals: moments(p.mesh.normals),
    w,
    wOrdered,
  }
}
