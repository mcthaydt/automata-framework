// A base-pair figure standing in one of the eight views, posed and painted the way the figure layer does it: the sprite
// cheats into the pose, the pose into the soup, the soup into a cell.

import { BASE_PAIR, BASE_PAIR_SWATCHES } from '#src/entries/base.ts'
import type { Gait } from '#src/features/figures/content/gait.schema.ts'
import { build } from '#src/features/figures/figure/build.ts'
import type { FigureDef } from '#src/features/figures/figure/figure.schema.ts'
import { faceOf } from '#src/features/figures/figure/figure.schema.ts'
import { skeleton } from '#src/features/figures/figure/figure-skeleton.ts'
import { gaitOf } from '#src/features/figures/motion/gait-of.ts'
import { evaluateMotion } from '#src/features/figures/motion/hold.ts'
import type { FaceStamp } from '#src/features/figures/paint/face-stamp.ts'
import { bendsOf } from '#src/features/figures/paint/marks.ts'
import { type PaintedCell, paintCell } from '#src/features/figures/paint/paint-cell.ts'
import { paintFigure, soupOf } from '#src/features/figures/paint/soup.ts'
import { spriteCheats } from '#src/features/figures/paint/sprite-cheats.ts'

const library = { swatches: BASE_PAIR_SWATCHES, hair: {}, headwear: {}, items: {} }
export const MEMBERS: Readonly<Record<'base-m' | 'base-f', FigureDef>> = {
  'base-m': BASE_PAIR.man,
  'base-f': BASE_PAIR.woman,
}

/** `view` is the figure's yaw against the camera, in 45° steps (0 front, counter-clockwise). */
export function posedCell(
  member: keyof typeof MEMBERS,
  gaits: Readonly<Record<string, Gait>>,
  density: number,
  pitchDeg: number,
  view: number,
): { painted: PaintedCell; face: FaceStamp | null } {
  const def = MEMBERS[member]
  const body = skeleton(def)
  const built = build(def, body, 'base', null, library)
  const gait = gaitOf(def, gaits)
  const pitch = (Math.round((pitchDeg * Math.PI) / 180 / (Math.PI / 90)) * Math.PI) / 90
  const yaw = view * (Math.PI / 4)
  const cheats = spriteCheats(yaw, 0, pitch, faceOf(def), gait.headLead)
  const { world } = evaluateMotion(body, gait, {
    t: 0,
    moving: false,
    phase: 0,
    yaw,
    headYaw: cheats.headYaw,
    lookUp: cheats.lookUp,
    view: cheats.view,
    pitch: cheats.pitch,
    shuffle: 0,
    clear: built.clearance,
  })
  const fig = paintFigure(def, body, built, 'base')
  const cell = soupOf(fig, body, world, { yaw, pitch, density }, 3)
  const painted = paintCell({
    soup: cell.soup,
    decals: cell.decals,
    materials: fig.materials,
    face: cell.face,
    hands: cell.hands,
    bends: bendsOf(body),
    cell: cell.cell,
    feet: cell.feet,
    metres: 2.6,
    neck: fig.neck,
    skin: fig.skin,
    ...(cell.cloth ? { cloth: cell.cloth } : {}),
  })
  return { painted, face: cell.face }
}
