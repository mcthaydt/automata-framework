// The layer painted figures are drawn in: each frame it takes the figures a view has added, finds the cell each wants
// from where the camera is (one of eight directions, the camera's pitch to 2°, the view's density), lights it as a
// sprite in the room's light, hazes and snaps it as the scene's texels are, and hands the composite pass the cells to
// stand at whole field pixels. It paints at most one cell a frame, the most wanted first, and shows the last cell a
// figure had while the right one waits, so a turn or a change of view never leaves a figure undrawn.

import type { Mesh3D } from '@pixi/3d'
import type { SceneLight } from '../../../shared/render/light/scene-light.ts'
import { hazeShare, stepLight } from '../../../shared/render/texel.ts'
import { CellCache } from '../cells/cell-cache.ts'
import { type DensityLimits, viewDensity } from '../cells/density.ts'
import { type FinishLook, finishCell } from '../cells/finish-cell.ts'
import { PaintQueue } from '../cells/paint-queue.ts'
import { keyDirection, spriteLamps } from '../cells/sprite-lamps.ts'
import { lightCell, type SpriteLamp, type SpriteStyle } from '../cells/sprite-light.ts'
import type { PaintedCell } from '../paint/paint-cell.ts'
import type { CellView } from '../paint/soup.ts'
import { CellCompositePass, type PlacedCell } from './cell-composite-pass.ts'
import { CellTextures } from './cell-textures.ts'
import { createFigureShadow, type FigureShadow } from './figure-shadow.ts'

type V3 = readonly [number, number, number]

/** The part of a `View3D` the layer reads: the field it draws, its camera, and where a world point lands in the field. */
export interface LayerView {
  readonly width: number
  readonly height: number
  readonly camera: {
    readonly fov: number
    getGlobalTransform(): { readonly elements: ArrayLike<number> }
  }
  worldToScreen(position: { x: number; y: number; z: number }): { x: number; y: number } | null
  /** The scene's root: the shadows are floor quads added to it. */
  readonly root: { addChild(child: Mesh3D): unknown; removeChild(child: Mesh3D): unknown }
}

/** A cell the layer can show, with the key the cache holds it by. */
export interface FoundCell {
  readonly key: string
  readonly cell: PaintedCell
}

/** A figure the layer draws: where it stands and which way it faces, and the cell for a view of it. */
export interface LayerFigure {
  place(): { readonly at: V3; readonly yaw: number }
  /**
   * The painted cell for `view`: the cache's, or, when it is not there, the last cell this figure showed while the right
   * one is asked of `queue` at `priority` (a lower number is painted sooner). None before the first is painted.
   */
  cell(view: CellView, cache: CellCache, queue: PaintQueue, priority: number): FoundCell | undefined
}

export interface FigureLayer {
  /** Draws `figure` from the next frame; the returned function stops drawing it. */
  add(figure: LayerFigure): () => void
  /** The distance of the view's focus, in metres: it sets the density every figure is painted at and where the haze starts. */
  setFocus(distance: number): void
  /** Paints one cell if one waits, and shows the figures. */
  frame(): void
  readonly pass: CellCompositePass
  dispose(): void
}

/** Where a figure's chest is above its feet, in metres: where the light on it is taken. */
const CHEST = 1.1
const EIGHTH = Math.PI / 4
/** The camera's pitch is kept to this, so a slow tilt paints once a step. */
const PITCH_STEP = (2 * Math.PI) / 180

const wrap = (a: number): number => a - 2 * Math.PI * Math.round(a / (2 * Math.PI))

/** What the layer reads of the look: the figures' density bounds and cache, the room's light step, the sprite's light and
 * its shadow. A feature may not import the look, so the app passes it in and this is the part that is read. */
export interface LayerLook extends FinishLook {
  readonly figures: DensityLimits & { readonly cacheBytes: number }
  readonly light: { readonly step: number; readonly max: number }
  readonly figureLight: { readonly ambient: number } & SpriteStyle
  readonly figureShadow: number
}

export function createFigureLayer(
  view: LayerView,
  look: LayerLook,
  light: SceneLight | undefined,
): FigureLayer {
  const pass = new CellCompositePass()
  const cache = new CellCache(look.figures.cacheBytes)
  const queue = new PaintQueue()
  const textures = new CellTextures()
  const figures = new Set<LayerFigure>()
  const lits = new WeakMap<PaintedCell, { key: string; lit: PaintedCell }>()
  /** The shadow each figure casts, and what it was last drawn for, so it is redrawn only when that changes. */
  const shadows = new Map<LayerFigure, { shadow: FigureShadow; drawn: string; cell?: PaintedCell }>()
  let focus: number | undefined

  /** The field's short side in pixels and the lens's field of view along it (rad). */
  const lens = (): { short: number; fovShort: number } => {
    const tanV = Math.tan((view.camera.fov * Math.PI) / 360)
    const short = Math.min(view.width, view.height)
    const tanShort = view.width >= view.height ? tanV : (tanV * view.width) / Math.max(view.height, 1)
    return { short, fovShort: 2 * Math.atan(tanShort) }
  }
  const density = (distance: number): number => {
    const { short, fovShort } = lens()
    return viewDensity(Math.max(short, 1), Math.max(distance, 0.1), fovShort, look.figures)
  }

  /** The cell lit by the room, kept for the cell while its light stays within a step. */
  const lit = (cell: PaintedCell, lamps: readonly SpriteLamp[], ambient: V3): PaintedCell => {
    const { step, max } = look.light
    const q = (v: number): number => Math.round(v / step)
    const key = [
      ...ambient.map(q),
      ...lamps.flatMap((l) => [...l.dir.map((d) => Math.round(d * 20)), ...l.rgb.map(q)]),
    ].join(',')
    const known = lits.get(cell)
    if (known?.key === key) return known.lit
    const made = lightCell(cell, lamps, ambient, { step, max, style: look.figureLight })
    lits.set(cell, { key, lit: made })
    return made
  }

  /** Stands `figure`'s shadow at its feet, drawn again only when the cell, the light or the view's turn has changed. */
  const cast = (
    figure: LayerFigure,
    cell: PaintedCell,
    root: V3,
    key: V3 | undefined,
    right: [number, number],
    pitch: number,
  ): void => {
    let held = shadows.get(figure)
    if (held === undefined) {
      held = { shadow: createFigureShadow(look.figureShadow), drawn: '' }
      shadows.set(figure, held)
      view.root.addChild(held.shadow.mesh)
    }
    const q = (v: number): number => Math.round(v * 20)
    const drawn = [...(key ?? []).map(q), ...right.map(q), q(pitch)].join(',')
    if (held.cell !== cell || held.drawn !== drawn) {
      held.cell = cell
      held.drawn = drawn
      held.shadow.update(cell, root, key, { right, pitch })
    } else held.shadow.mesh.position.set(root[0], root[1] + 0.01, root[2])
  }
  const uncast = (figure: LayerFigure): void => {
    const held = shadows.get(figure)
    if (held === undefined) return
    view.root.removeChild(held.shadow.mesh)
    held.shadow.destroy()
    shadows.delete(figure)
  }

  function frame(): void {
    queue.runOne()
    textures.begin()
    const e = view.camera.getGlobalTransform().elements
    const eye: V3 = [e[12] ?? 0, e[13] ?? 0, e[14] ?? 0]
    // The camera looks along its own -z.
    const forward: V3 = [-(e[8] ?? 0), -(e[9] ?? 0), -(e[10] ?? 0)]
    const placed: PlacedCell[] = []
    const shown: string[] = []
    for (const figure of figures) {
      const { at, yaw } = figure.place()
      const chest: V3 = [at[0], at[1] + CHEST, at[2]]
      // From the figure toward the camera: the sprite is drawn facing it, so its azimuth and pitch are the cell's.
      const dx = eye[0] - chest[0]
      const dy = eye[1] - chest[1]
      const dz = eye[2] - chest[2]
      const toward = Math.atan2(dx, dz)
      const pitch = Math.round(Math.asin(dy / (Math.hypot(dx, dy, dz) || 1)) / PITCH_STEP) * PITCH_STEP
      const rootDepth =
        (at[0] - eye[0]) * forward[0] + (at[1] - eye[1]) * forward[1] + (at[2] - eye[2]) * forward[2]
      if (rootDepth <= 0) continue
      focus ??= rootDepth
      const d = density(focus)
      const direction = Math.round(wrap(yaw - toward) / EIGHTH)
      const want: CellView = { yaw: direction * EIGHTH, pitch, density: d }
      const found = figure.cell(want, cache, queue, 0)
      if (found === undefined) continue
      // The neighbours a turn would ask for next, painted when nothing more wanted waits.
      figure.cell({ ...want, yaw: want.yaw + EIGHTH }, cache, queue, 10)
      figure.cell({ ...want, yaw: want.yaw - EIGHTH }, cache, queue, 10)
      shown.push(found.key)
      const screen = view.worldToScreen({ x: at[0], y: at[1], z: at[2] })
      if (screen === null) continue
      // The root is on the field pixel its projection falls in, and the feet texel is the cell's texel there.
      const x = Math.floor(screen.x) - Math.floor(found.cell.feet[0])
      const y = Math.floor(screen.y) - Math.floor(found.cell.feet[1])
      let veil: V3 = [1, 1, 1]
      let lamps: readonly SpriteLamp[] = []
      let ambient: V3 = [1, 1, 1]
      if (light !== undefined) {
        const sprite = spriteLamps(light, chest, { pitch, azimuth: toward }, look.figureLight.ambient)
        lamps = sprite.lamps
        ambient = sprite.ambient
        const sum = lamps.reduce<[number, number, number]>(
          (s, l) => [s[0] + l.rgb[0], s[1] + l.rgb[1], s[2] + l.rgb[2]],
          [ambient[0], ambient[1], ambient[2]],
        )
        veil = stepLight(
          [
            Math.min(sum[0], look.light.max),
            Math.min(sum[1], look.light.max),
            Math.min(sum[2], look.light.max),
          ],
          look.light.step,
        )
      }
      const cell = light === undefined ? found.cell : lit(found.cell, lamps, ambient)
      // Where the camera's right lies on the floor, so the shadow's mask is drawn for the sprite the camera sees.
      const rl = Math.hypot(e[0] ?? 0, e[2] ?? 0) || 1
      cast(
        figure,
        found.cell,
        at,
        light === undefined ? undefined : keyDirection(light, chest),
        [(e[0] ?? 0) / rl, (e[2] ?? 0) / rl],
        pitch,
      )
      const share = hazeShare(rootDepth - focus, look.haze)
      const colours = finishCell(cell, veil, share, [x, y], look)
      const leased = textures.lease(cell, colours)
      placed.push({
        colours: leased.colours,
        depth: leased.depth,
        source: [0, 0],
        x,
        y,
        width: cell.width,
        height: cell.height,
        rootDepth,
      })
    }
    cache.hold(shown)
    pass.show(placed)
  }

  return {
    add(figure) {
      figures.add(figure)
      return () => {
        figures.delete(figure)
        uncast(figure)
      }
    },
    setFocus(distance) {
      focus = distance
    },
    frame,
    pass,
    dispose() {
      for (const figure of [...shadows.keys()]) uncast(figure)
      figures.clear()
      pass.show([])
      textures.dispose()
      pass.destroy()
    },
  }
}
