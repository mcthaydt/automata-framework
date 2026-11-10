import type { V3 } from '../lib/math.ts'
import { RAMPS } from '../paint/duel-ramps.ts'
import type { Weave } from '../paint/fabric.ts'
import { tiled } from '../paint/row.ts'
import { grade, onRow, stepBy, toward } from './grade.ts'
import { type Lamp, lampSteps, strength, type TimeOfDay, viewToWorld } from './lamps.ts'
/**
 * Real character lighting: a painted figure (figure.ts: its DUEL colours and its normal map) lit with no environment.
 * Each texel moves whole steps along its own DUEL row: the time's exposure and the cast's lift, then the lamps' steps on
 * its normal (capped at the strongest lamp's), tinted toward the strongest lamp's colour (or the time's ambient) in
 * OKLab and snapped back to DUEL; ink stays ink, and no texel goes down onto its row's darkest step. A bounce colours the
 * undersides and lowest rows with the floor's colour, and the silhouette's edge on a glowing thing's side with its glow.
 * Extracted verbatim from the scene's figure compositing (the scene is gone); `lightFigure` is its per-texel loop.
 */
/** What lights a figure's texels: the time of day, lamps (their strength now, the most steps one gives), the whole
 * steps the figure moves (exposure, its lift, a shadow, a sector's shade) and each lamp's reach to it (0–1). */
export interface FigureLight {
  time: TimeOfDay
  lamps: Lamp[]
  strengths: number[]
  cap: number
  shift: number
  reach?: number[] | undefined
}
/** A figure texel lit: along its own DUEL row by the shift and the lamps' steps on its
 * normal (world), tinted in OKLab, snapped to DUEL. Never down onto a row's darkest step. */
function figureColour(rgb: number, n: V3, p: V3, L: FigureLight, own = false) {
  let sum = 0,
    top = -1,
    topS = 0
  L.lamps.forEach((l, li) => {
    const s =
      lampSteps(l, L.strengths[li]!, p[0], p[1], p[2], n[0], n[1], n[2]) * (L.reach ? L.reach[li] : 1)!
    sum += s
    if (s > topS) {
      topS = s
      top = li
    }
  })
  const [row, st] = onRow(rgb),
    step = Math.max(Math.min(st, 1), Math.min(7, st + L.shift + Math.min(L.cap, Math.floor(sum + 0.2))))
  // A fabric's ground keeps its own hue row: whole steps along it, with no tint to snap it onto a neighbour row patch by
  // patch (a row's darkest step, ink or a family dark, holds). The tile is laid after, on the same row.
  if (own) return st === 0 ? rgb : RAMPS[row]![step]
  const lamp = top >= 0 && sum >= 0.8,
    tint = lamp ? parseInt(L.lamps[top]!.color.slice(1), 16) : parseInt(L.time.ambient.slice(1), 16),
    amt = lamp ? (L.lamps[top]!.tint ?? 0.35) * 0.7 : L.time.tint * 0.7
  return grade(RAMPS[row]![step]!, tint, Math.round(amt * 8) / 8)
}
/** Bounce light on a figure: the floor's colour (under its feet) on its undersides and lowest rows, and a glowing thing's
 * colour on its silhouette's edge on that thing's side (`side` −1 left, +1 right). */
export interface Bounce {
  floor: number
  glow?: number | undefined
  side?: number | undefined
}
/** A figure texel with its bounce light (grade.ts toward and stepBy: stepped, snapped). */
function bounced(col: number, b: Bounce, under: boolean, rim: boolean) {
  if (under) col = toward(col, b.floor, 0.35)
  if (rim && b.glow !== undefined) col = stepBy(toward(col, b.glow, 0.4), 1)!
  return col
}
/** What lights a figure: a time of day, its lamps (figure space, lamps.ts), the moment (s; for a flicker or a light
 * style), whether it stands in shade (a step down), a bounce, and where its feet stand in that space (the origin by
 * default; lamps placed in a larger world's space light it where it stands). */
export interface Lighting {
  time: TimeOfDay
  lamps: Lamp[]
  t?: number | undefined
  shade?: boolean | undefined
  bounce?: Bounce | undefined
  at?: V3 | undefined
}
/** A figure-like source of a painted cell (figure.ts Figure is one): its colours and normal map (RGBA, a normal's
 * x, y, z as 0–255 with alpha 0 where none), its cell's size, its feet's row, the metres its cell shows, and the pitch
 * it was drawn at (rad); and, for a figure drawn with a fabric (H5), its `weave`: the untiled colours and tile labels
 * (paint.ts), so the cloth's ground is lit and the tile laid after, a step along the lit colour's row. */
export interface LitSource {
  painted: Uint8ClampedArray
  normals: Uint8ClampedArray
  cell: [number, number]
  feet: number
  metres: number
  pitch: number
  weave?: Weave | null | undefined
}
/** A figure lit: a new RGBA cell, each painted texel moved along its own DUEL row by `L` (figureColour), with the
 * bounce on its undersides and edge. Each texel in turn, with no placement and no depth test. */
export function lightFigure(f: LitSource, L: Lighting): Uint8ClampedArray {
  const [w, h] = f.cell,
    weave = f.weave ?? null,
    rgba = f.painted,
    N = f.normals,
    out = new Uint8ClampedArray(w * h * 4),
    root = L.at ?? [0, 0, 0]
  const lamps = L.lamps,
    t = L.t ?? 0,
    strengths = lamps.map((l) => strength(l, t)),
    cap = Math.max(0, ...lamps.map((l) => l.steps))
  const shift = L.time.exposure + (L.time.figureLift ?? 0) - (L.shade ? 1 : 0)
  const ppm = h / f.metres,
    c = Math.cos(f.pitch),
    feetRow = h - f.feet,
    bounce = L.bounce
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const o = (y * w + x) * 4
      if (!rgba[o + 3]) continue
      // A tiled texel lights its ground (the untiled colour), then the tile steps on along the lit colour's row.
      const on = weave !== null && weave.on[y * w + x] === 1,
        src = on ? weave.ground : rgba
      const rgb = (src[o]! << 16) | (src[o + 1]! << 8) | src[o + 2]!
      // Ink (the outline under and away from the key) stays ink.
      if (rgb === 0) {
        out[o] = out[o + 1] = out[o + 2] = 0
        out[o + 3] = 255
        continue
      }
      const n = N[o + 3]
        ? viewToWorld([N[o]! / 127.5 - 1, 1 - N[o + 1]! / 127.5, N[o + 2]! / 127.5 - 1], f.pitch)
        : viewToWorld([0, 0, 1], f.pitch)
      const px = root[0] + (x - w / 2) / ppm,
        py = root[1] + Math.max(0, (feetRow - y) / (ppm * c)),
        pz = root[2]
      let col = figureColour(rgb, n, [px, py, pz], { time: L.time, lamps, strengths, cap, shift }, on)
      if (bounce && !on) {
        const s = bounce.side ?? 0,
          edge = s !== 0 && (x + s < 0 || x + s >= w || !rgba[(y * w + x + s) * 4 + 3])
        col = bounced(col!, bounce, n[1] < -0.2 || y > feetRow - h * 0.12, edge)
      }
      if (on) col = tiled(col!, weave.labels[y * w + x]!, weave.lo[y * w + x]!, weave.hi[y * w + x]!)
      out[o] = (col! >> 16) & 255
      out[o + 1] = (col! >> 8) & 255
      out[o + 2] = col! & 255
      out[o + 3] = 255
    }
  return out
}
