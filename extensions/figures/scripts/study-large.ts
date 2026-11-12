/**
 * The large sheets of the painter-look study: a figure drawn at density 4 (and the same figure smaller, to show she still
 * reads), with its head and shoulders cropped and enlarged. Judged against the Owner's bar (the audit's README), never
 * against a density-1 or density-2 picture. Data in, pixels out: nothing here draws a texel.
 */
import { createCanvas } from '@napi-rs/canvas'
import type { CharacterDef } from '../src/shared/figure/cast'
import { Figure } from '../src/shared/figure/figure'
import { type Frame, member, view } from '../src/shared/figure/frames'
import { FACE_SEAM, type PaintStyle } from '../src/shared/paint/paint'

/** One figure on a large sheet: a character, its paint style and a caption. */
export interface Entry {
  readonly label: string
  readonly def: CharacterDef
  readonly paint?: Partial<PaintStyle>
}

export interface Drawn {
  readonly w: number
  readonly h: number
  readonly px: Frame
  readonly part: ArrayLike<number>
}

/** A figure standing still facing view `d` (eighths of a turn) at `density`. */
export function standing(
  def: CharacterDef,
  d: number,
  density: number,
  paint: Partial<PaintStyle> = {},
): Drawn {
  const cast = member(def, density),
    f = new Figure(cast)
  Object.assign(f.paintStyle, paint)
  for (let i = 0; i < 3; i++) f.update(1 / 60, { facing: (d * Math.PI) / 4, moving: false, view: view() })
  return { w: cast.cell[0], h: cast.cell[1], px: f.painted.slice() as Frame, part: f.g.part.slice() }
}

/** The rows the figure covers, and the head: from the top of the figure to the chin (the last row of the face's skin). */
export function extent(s: Drawn) {
  let top = -1,
    bottom = -1,
    chin = -1,
    left = s.w,
    right = -1
  for (let y = 0; y < s.h; y++)
    for (let x = 0; x < s.w; x++) {
      const k = y * s.w + x
      if (!s.px[k * 4 + 3]) continue
      if (top < 0) top = y
      bottom = y
      left = Math.min(left, x)
      right = Math.max(right, x)
      if (s.part[k] === FACE_SEAM) chin = y
    }
  return { top, bottom, chin, left, right, rows: bottom - top + 1, head: chin - top + 1 }
}

type Ctx = ReturnType<ReturnType<typeof createCanvas>['getContext']>
function put(ctx: Ctx, s: Drawn, x: number, y: number, z: number, crop: [number, number, number, number]) {
  const c = createCanvas(s.w, s.h),
    k = c.getContext('2d'),
    img = k.createImageData(s.w, s.h)
  img.data.set(s.px)
  k.putImageData(img, 0, 0)
  ctx.imageSmoothingEnabled = false
  ctx.drawImage(c, crop[0], crop[1], crop[2], crop[3], x, y, crop[2] * z, crop[3] * z)
}

/** Numbers measured from a figure's own pictures at a density. */
export function sizes(def: CharacterDef, density: number, paint: Partial<PaintStyle> = {}) {
  const e = extent(standing(def, 0, density, paint))
  return { density, rows: e.rows, headRows: e.head, headsTall: Math.round((e.rows / e.head) * 100) / 100 }
}

export interface LargeOptions {
  /** Density of the large figure (default 4). */
  readonly density?: number
  /** Densities of the small strip under each figure (default none). */
  readonly strip?: readonly number[]
  /** Zoom of the standing views (default 2) and of the head-and-shoulders crop (default 4). */
  readonly zoom?: number
  readonly zoomHead?: number
  readonly title?: string
}

/**
 * One row per entry: front, 3/4, side and back standing at the large density; the head and shoulders, front and 3/4, enlarged;
 * and, if asked, a small strip of the same figure at lower densities at the same size on the screen.
 */
export function largeSheet(entries: readonly Entry[], o: LargeOptions = {}): Buffer {
  const D = o.density ?? 4,
    Z = o.zoom ?? 2,
    ZH = o.zoomHead ?? 4,
    strip = o.strip ?? []
  // The frame of every row: the figure's bounding box in front, padded, so a row is as tall as its figure.
  const front = entries.map((e) => standing(e.def, 0, D, e.paint))
  const ext = front.map(extent)
  const pad = 8,
    colW = Math.max(...ext.map((e) => e.right - e.left + 1)) + 2 * 34,
    figH = Math.max(...ext.map((e) => e.rows)) + 2 * pad
  const headW = 120,
    headH = 112
  const stripH = strip.length ? Math.round(figH / 2) * 1 : 0
  const rowH = figH * Z + 30 + (strip.length ? stripH + 16 : 0)
  const W = Math.max(4 * colW * Z + 2 * (headW * ZH) + 40, 800)
  const c = createCanvas(W, 36 + rowH * entries.length + 10),
    ctx = c.getContext('2d')
  ctx.fillStyle = '#26282b'
  ctx.fillRect(0, 0, c.width, c.height)
  ctx.fillStyle = '#e8e8e8'
  ctx.font = '20px sans-serif'
  ctx.fillText(o.title ?? `density ${D}`, 8, 24)
  ctx.font = '14px sans-serif'
  let y0 = 36
  entries.forEach((e, i) => {
    const ex = ext[i]
    ctx.fillStyle = '#ffd479'
    ctx.fillText(`${e.label} — head ${ex.head} rows, figure ${ex.rows} rows at density ${D}`, 8, y0 + 14)
    y0 += 20
    const cx = Math.round((ex.left + ex.right) / 2),
      top = ex.top - pad
    ;[0, 1, 2, 4].forEach((d, j) => {
      const s = d === 0 ? front[i] : standing(e.def, d, D, e.paint)
      put(ctx, s, j * colW * Z, y0, Z, [cx - Math.round(colW / 2), top, colW, figH])
    })
    // Head and shoulders: from just over the head to the chest.
    ;[0, 1].forEach((d, j) => {
      const s = d === 0 ? front[i] : standing(e.def, d, D, e.paint),
        sx = extent(s)
      put(ctx, s, 4 * colW * Z + 20 + j * (headW * ZH + 10), y0, ZH, [
        Math.round((sx.left + sx.right) / 2 - headW / 2),
        sx.top - 3,
        headW,
        headH,
      ])
    })
    y0 += figH * Z + 6
    // The same figure at lower densities, each at the same size on the screen as the large one's x2.
    let sx0 = 0
    strip.forEach((sd) => {
      ;[0, 1].forEach((d) => {
        const s = standing(e.def, d, sd, e.paint),
          se = extent(s),
          z = (D * Z) / sd / 2
        const w = 50 * sd
        put(ctx, s, sx0, y0, z, [Math.round((se.left + se.right) / 2 - w / 2), se.top - 2, w, se.rows + 4])
        sx0 += Math.round(w * z) + 10
      })
    })
    if (strip.length) y0 += stripH + 16
    y0 += 24
  })
  return c.toBuffer('image/png')
}
