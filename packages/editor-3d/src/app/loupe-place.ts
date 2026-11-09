// Where the loupe and the nudge pad sit over the plan (ED3D.6g-b, plan decision 2; ED3D spec §10: clear of the contact
// point and of the screen edge). Plain arithmetic on canvas pixels, so the rules are unit tests and the canvas only
// places two boxes.
import type { Point as ScreenPoint, Size } from '@automataframework/automata-editor/kit/core'
import { PICK_RADIUS } from '../view/plan/plan-pick'

/** The loupe's diameter and the nudge pad's side, in canvas pixels (the mockup's sizes). */
export const LENS = 140
export const PAD = 148
/** How far the lens sits from the point: clear of a fingertip and of the hand behind a Pencil. */
const GAP = 56
const EDGE = 8
const PAD_EDGE = 12

const clamp = (value: number, low: number, high: number): number => Math.min(Math.max(value, low), high)

/** The lens's top-left: above and right of `at`, flipped left at the right edge and below at the top. */
export function loupePlace(at: ScreenPoint, canvas: Size, lens: number = LENS): ScreenPoint {
  let x = at.x + GAP
  if (x + lens > canvas.w - EDGE) x = at.x - GAP - lens
  let y = at.y - GAP - lens
  if (y < EDGE) y = at.y + GAP
  return { x: clamp(x, EDGE, canvas.w - EDGE - lens), y: clamp(y, EDGE, canvas.h - EDGE - lens) }
}

/**
 * The pad's corner: the bottom right, or the bottom left when `at` is under the pad there or a finger's reach from it.
 * The canvas places it in that corner with CSS, above whatever covers the plan's foot (ED3D.5f's tool strip and sheet).
 */
export function nudgePlace(at: ScreenPoint | undefined, canvas: Size, pad: number = PAD): 'left' | 'right' {
  const right = { x: canvas.w - PAD_EDGE - pad, y: canvas.h - PAD_EDGE - pad }
  const reach = PICK_RADIUS.touch
  const near =
    at !== undefined &&
    at.x >= right.x - reach &&
    at.x <= right.x + pad + reach &&
    at.y >= right.y - reach &&
    at.y <= right.y + pad + reach
  return near ? 'left' : 'right'
}
