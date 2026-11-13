// The stage contract's placement rule (extensions/figures/docs/contract.md, section 2) for one figure: where its painted
// cell lands on screen, how many pixels a texel covers, and where a quad that shows it stands in the scene. The
// builder's own `stageFrame` does this for its `ScriptedActor`s; a figure here is a sim entity, so the kit applies the same
// rule to it, and tests/unit/painted/place.test.ts holds the two together. Pure: no Pixi, so it runs in Node.
import {
  type CameraPose,
  type Cell,
  project,
  SPRITE_PITCH,
  type StageSprite,
  type V3,
  type View,
  viewOf,
  zoomOf,
} from '../../shared/figures/door.ts'

/** The density the kit paints at unless a figure asks otherwise: the builder's own working resolution. */
export const DEFAULT_DENSITY = 2

/** How a cell is placed: the density it was painted at, and whether a texel is a whole number of pixels. */
export interface PlaceOptions {
  /** Texels per texel of the base cell; `zoomOf` counts screen pixels per density-1 texel, so a texel is `zoom / density` pixels. */
  readonly density?: number | undefined
  /**
   * Whole pixels a texel (the default): `max(1, round(zoom / density))`, never minified, evenly wide, and a figure's height
   * is off by the rounding. `false` draws it at its true height, a texel `zoom / density` pixels wide, so texels are of uneven
   * width on screen, as FigureBuilder's `crisp: false` and a game's own figures are.
   */
  readonly crisp?: boolean | undefined
  /**
   * Puts the cell's top-left on a multiple of `scale` (a texel's whole pixels) instead of any whole pixel, so every texel of
   * every figure lies on one lattice anchored at the field's origin: what a pattern drawn between texels needs, such as an LCD
   * mesh whose cell is one texel at the screen's pixels (`@automata/lcd-panel`'s screen filter). The figure then moves a texel
   * at a time, never more than half a texel from its true place. Only with whole-pixel texels (`crisp`, the default). Default off.
   */
  readonly grid?: boolean | undefined
}

/** A figure behind this many metres of a perspective camera is out of the frame (the contract's `d < 0.1`). */
const NEAREST = 0.1

/** One figure placed for a frame. */
export interface Placed {
  /** The builder's own shape: name, cell, feet, where the cell's top-left lands, pixels a texel, distance along the view. */
  readonly sprite: StageSprite
  /** Where the quad that shows the cell stands in the scene, on its anchor texel. */
  readonly position: readonly [number, number, number]
  /** Metres one texel covers on that quad. */
  readonly pixelSize: number
}

/** The view a figure at `at` is painted from: the pose's bearing round it, at the painter's pitch, not the camera's tilt. */
export function paintView(pose: CameraPose, at: V3): View {
  return { azimuth: viewOf(pose, at).azimuth, pitch: SPRITE_PITCH }
}

/**
 * The contract's placement for a figure standing at `at`, painted as `cell`, or undefined when it is behind a perspective
 * camera. Crisp (the default): `scale = max(1, round(zoom / density))` whole pixels a texel, so a texel is never minified;
 * not crisp: `scale = zoom / density`. Either way the cell's top-left is rounded to a whole pixel, or with `grid` to a whole texel. The quad is square to the image plane (its axes the pose's right and up), at
 * `eye + d · fwd` offset so the anchor texel lands on `screen + scale · anchor`, which is what `StageView.draw` does.
 */
export function place(
  pose: CameraPose,
  at: V3,
  cell: Cell,
  name: string,
  options: PlaceOptions = {},
): Placed | undefined {
  const density = options.density ?? DEFAULT_DENSITY
  const [ax, ay, depth] = project(pose, at)
  if (pose.f !== undefined && depth < NEAREST) return undefined
  // A whole zoom to 1e-9 counts as whole: a host's `pixelsPerMetre` need not round-trip, and `round` must not tip over.
  const raw = zoomOf(pose, at)
  const zoom = Math.abs(raw - Math.round(raw)) < 1e-9 && Math.round(raw) >= 1 ? Math.round(raw) : raw
  const scale = options.crisp === false ? zoom / density : Math.max(1, Math.round(zoom / density))
  // On the texel lattice a top-left rounds to the nearest multiple of `scale`; otherwise to the nearest pixel.
  const step = options.grid === true && options.crisp !== false ? scale : 1
  const snap = (v: number): number => Math.round(v / step) * step
  const screen: [number, number] = [snap(ax - scale * cell.anchor[0]), snap(ay - scale * cell.anchor[1])]
  // Metres a screen pixel covers at the figure's depth: d / f under perspective, 1 / pixelsPerMetre under orthographic.
  const k = pose.f !== undefined ? depth / pose.f : 1 / (pose.pixelsPerMetre ?? 1)
  const [w, h] = pose.size
  const px = (screen[0] + scale * cell.anchor[0] - w / 2) * k
  const py = (screen[1] + scale * cell.anchor[1] - h / 2) * k
  const position: [number, number, number] = [
    pose.eye[0] + depth * pose.fwd[0] + px * pose.right[0] - py * pose.up[0],
    pose.eye[1] + depth * pose.fwd[1] + px * pose.right[1] - py * pose.up[1],
    pose.eye[2] + depth * pose.fwd[2] + px * pose.right[2] - py * pose.up[2],
  ]
  return { sprite: { name, cell, at, screen, scale, depth }, position, pixelSize: scale * k }
}

/** The frame's order, far to near, a tie in the order given (the later is drawn on top): an entry's index is its rank. */
export function ranked(placed: readonly Placed[]): Placed[] {
  return [...placed].sort((a, b) => b.sprite.depth - a.sprite.depth)
}
