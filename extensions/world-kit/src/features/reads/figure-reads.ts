// Readability: does a figure read against the room behind it? A measure on a finished frame, for the checks and the
// tests, not a pass of the painter.
//
// The rule is a figure must differ from the ring of scene around it by at least 1.1×, in luma or in edge energy, whichever
// is stronger, either way round (a dark figure on a light room reads as a light one on a dark). The ring of 3, the 0.01
// and the 20-texel minimum are this measure's own.
//
//   - A figure's texels are where the frame's composited depth is not the scene's alone, grouped into 8-connected runs of
//     at least `MIN_TEXELS` texels (a speck is not a figure).
//   - Its ring is every texel within `ring` (Chebyshev) of the figure that is no figure's.
//   - Luma is Rec. 709 on 0 to 1. Luma ratio = (brighter + EPS) / (darker + EPS).
//   - A texel's edge energy is the largest |Δluma| to its in-frame 4-neighbours. A figure texel counts every neighbour, so
//     the silhouette counts as the figure's edge; a ring texel counts only its non-figure neighbours. Edge ratio = (the
//     figure's mean + EPS) / (the ring's mean + EPS).
//   - It reads as the stronger of the two. A figure with no ring (it fills the frame) reads 1.

/** A drawn frame and the two depth buffers that tell the figures from the scene. */
export interface Frame {
  readonly width: number
  readonly height: number
  /** Four bytes a pixel. */
  readonly rgba: ArrayLike<number>
  /** The scene's own depth, per texel. */
  readonly sceneDepth: ArrayLike<number>
  /** The frame's depth after the figures were composited in: it differs from the scene's where a figure is. */
  readonly frameDepth: ArrayLike<number>
}

export interface FigureRead {
  /** The figure's texels, and its ring's. */
  readonly texels: number
  readonly ringTexels: number
  /** Mean luma of the figure and of its ring (0 to 1). */
  readonly figure: number
  readonly around: number
  /** Mean edge energy of the figure (silhouette included) and of its ring. */
  readonly figureEdge: number
  readonly aroundEdge: number
  /** The luma ratio (at least 1, either way round), the edge ratio (figure over ring), and the stronger of the two. */
  readonly luma: number
  readonly edge: number
  readonly read: number
}

const EPS = 0.01
const MIN_TEXELS = 20
const SCENE = -1
const UNNUMBERED = -2

/** The figures in a frame, in scan order of their first texel, each with how it reads against its ring. */
export function figureReads(frame: Frame, ring = 3): FigureRead[] {
  const { width, height, rgba, sceneDepth, frameDepth } = frame
  const luma = (k: number): number =>
    (0.2126 * (rgba[k * 4] ?? 0) + 0.7152 * (rgba[k * 4 + 1] ?? 0) + 0.0722 * (rgba[k * 4 + 2] ?? 0)) / 255
  // id[k]: SCENE for the scene, UNNUMBERED for a figure texel not yet grouped, else the run it belongs to (0, 1, ...).
  const id = new Int32Array(width * height)
  for (let k = 0; k < width * height; k++) id[k] = frameDepth[k] !== sceneDepth[k] ? UNNUMBERED : SCENE
  const runs: number[][] = []
  for (let start = 0; start < width * height; start++) {
    if (id[start] !== UNNUMBERED) continue
    const run: number[] = []
    const stack = [start]
    id[start] = runs.length
    while (stack.length > 0) {
      const k = stack.pop() as number
      const x = k % width
      const y = (k - x) / width
      run.push(k)
      for (let dy = -1; dy <= 1; dy++)
        for (let dx = -1; dx <= 1; dx++) {
          const nx = x + dx
          const ny = y + dy
          if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue
          const n = ny * width + nx
          if (id[n] === UNNUMBERED) {
            id[n] = runs.length
            stack.push(n)
          }
        }
    }
    runs.push(run)
  }
  /** The largest |Δluma| from texel k to its in-frame 4-neighbours that `counts`. */
  const edgeOf = (k: number, counts: (n: number) => boolean): number => {
    const x = k % width
    const y = (k - x) / width
    const here = luma(k)
    let edge = 0
    for (const [nx, ny] of [
      [x - 1, y],
      [x + 1, y],
      [x, y - 1],
      [x, y + 1],
    ] as const) {
      if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue
      const n = ny * width + nx
      if (counts(n)) edge = Math.max(edge, Math.abs(luma(n) - here))
    }
    return edge
  }
  const mean = (ks: readonly number[], f: (k: number) => number): number =>
    ks.reduce((sum, k) => sum + f(k), 0) / ks.length
  const out: FigureRead[] = []
  for (const texels of runs) {
    if (texels.length < MIN_TEXELS) continue
    // The ring: each scene texel within `ring` of the figure, once.
    const seen = new Set<number>()
    const around: number[] = []
    for (const k of texels) {
      const x = k % width
      const y = (k - x) / width
      for (let dy = -ring; dy <= ring; dy++)
        for (let dx = -ring; dx <= ring; dx++) {
          const nx = x + dx
          const ny = y + dy
          if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue
          const n = ny * width + nx
          if (id[n] === SCENE && !seen.has(n)) {
            seen.add(n)
            around.push(n)
          }
        }
    }
    const figure = mean(texels, luma)
    const figureEdge = mean(texels, (k) => edgeOf(k, () => true))
    if (around.length === 0) {
      out.push({
        texels: texels.length,
        ringTexels: 0,
        figure,
        around: figure,
        figureEdge,
        aroundEdge: figureEdge,
        luma: 1,
        edge: 1,
        read: 1,
      })
      continue
    }
    const ringLuma = mean(around, luma)
    const ringEdge = mean(around, (k) => edgeOf(k, (n) => id[n] === SCENE))
    const lumaRatio = (Math.max(figure, ringLuma) + EPS) / (Math.min(figure, ringLuma) + EPS)
    const edgeRatio = (figureEdge + EPS) / (ringEdge + EPS)
    out.push({
      texels: texels.length,
      ringTexels: around.length,
      figure,
      around: ringLuma,
      figureEdge,
      aroundEdge: ringEdge,
      luma: lumaRatio,
      edge: edgeRatio,
      read: Math.max(lumaRatio, edgeRatio),
    })
  }
  return out
}
