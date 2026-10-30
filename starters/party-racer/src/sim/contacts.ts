// What a racer touched this tick, and on which face (FloorFifty's `simulation/planck/facts.ts`, 677d456).
//
// FloorFifty read each contact's normal from Planck's pre-solve. `physics2d` reports collision events but no contact
// manifold, so the face is read from geometry instead (8b-D1): after the Rapier step has pushed the racer out of the
// floor, the two boxes sit face to face, and the axis with the larger gap is the one they meet on (the smaller
// overlap is the axis a solver separates along). FloorFifty's own reference controller tests contact geometry the
// same way, with the same one-pixel tolerance (`CONTACT_TOLERANCE_PIXELS`, 0.02 m at 50 px per metre).
//
// The approach test is FloorFifty's: a side or underside counts only when the racer was moving into it (relative to
// the floor), so a racer resting beside a floor is owed nothing; a top counts unless the racer is already leaving at
// `leavingTop` (half the bounce speed), so a landing at the apex of a bounce is not lost. The velocity is the one the
// racer entered the step with, which is what Box2D's pre-solve saw.

/** How close two faces must be to touch: Rapier leaves a resting body within its contact skin. Metres. */
export const CONTACT_TOLERANCE = 0.02

export interface ContactSizes {
  readonly racerHalfWidth: number
  readonly racerHalfHeight: number
  readonly floorHalfWidth: number
  readonly floorHalfHeight: number
}

/** A racer's centre after the step and its velocity entering the step. */
export interface ContactRacer {
  readonly x: number
  readonly y: number
  readonly vx: number
  readonly vy: number
}

/** A floor's centre after the step, its index and its horizontal velocity this tick. */
export interface ContactFloor {
  readonly index: number
  readonly x: number
  readonly y: number
  readonly vx: number
}

/**
 * `top`, `side` and `underside` are solid contacts on that face of the floor; `foot` is the racer's foot band (a
 * floor-high band centred on its bottom edge) overlapping the floor, which credits it.
 */
export interface ContactFact {
  readonly kind: 'top' | 'side' | 'underside' | 'foot'
  readonly floor: number
}

/** The racer's contacts with `floors`, sorted by floor index, then top, side, underside, foot: a total order. */
export function racerContacts(
  racer: ContactRacer,
  floors: readonly ContactFloor[],
  sizes: ContactSizes,
  leavingTop: number,
): ContactFact[] {
  const facts: ContactFact[] = []
  for (const floor of [...floors].sort((a, b) => a.index - b.index)) {
    const solid = solidContact(racer, floor, sizes, leavingTop)
    if (solid) facts.push({ kind: solid, floor: floor.index })
    if (feetOverlap(racer, floor, sizes)) facts.push({ kind: 'foot', floor: floor.index })
  }
  return facts
}

function solidContact(
  racer: ContactRacer,
  floor: ContactFloor,
  sizes: ContactSizes,
  leavingTop: number,
): 'top' | 'side' | 'underside' | undefined {
  const dx = racer.x - floor.x
  const dy = racer.y - floor.y
  const gapX = Math.abs(dx) - (sizes.racerHalfWidth + sizes.floorHalfWidth)
  const gapY = Math.abs(dy) - (sizes.racerHalfHeight + sizes.floorHalfHeight)
  if (gapX > CONTACT_TOLERANCE || gapY > CONTACT_TOLERANCE) return undefined
  if (gapY >= gapX) {
    // Met on a horizontal face. The normal points from the floor to the racer: up for a top, down for an underside.
    if (dy > 0) return racer.vy < leavingTop ? 'top' : undefined
    return -racer.vy < 0 ? 'underside' : undefined
  }
  const normalX = dx > 0 ? 1 : -1
  return (racer.vx - floor.vx) * normalX < 0 ? 'side' : undefined
}

function feetOverlap(racer: ContactRacer, floor: ContactFloor, sizes: ContactSizes): boolean {
  const feetY = racer.y - sizes.racerHalfHeight
  return (
    Math.abs(racer.x - floor.x) < sizes.racerHalfWidth + sizes.floorHalfWidth &&
    Math.abs(feetY - floor.y) < sizes.floorHalfHeight * 2
  )
}
