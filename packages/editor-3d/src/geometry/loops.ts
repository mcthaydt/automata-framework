// Outlines on the plan, before they are sectors: the questions a drawn loop of corners must answer (is it a polygon,
// is a point in it) and the sentences a refusal gives. They read only the first two members of a corner, so a loop of
// `[x, z, wall?]` corners and a loop of `[x, z]` points are the same thing here.

/** A corner as far as the plan goes: x and z first, whatever follows. */
export interface Planar {
  readonly 0: number
  readonly 1: number
}

export type Loop = readonly Planar[]

/** Two lengths this close are the same (coordinates are written to four decimals). */
const EPSILON = 1e-9

/** The area of the loop, positive when it runs counter-clockwise on the plan (x right, z up) and negative when it is clockwise. */
export const loopArea = (loop: Loop): number =>
  loop.reduce((sum, corner, i) => {
    const next = loop[(i + 1) % loop.length] as Planar
    return sum + corner[0] * next[1] - next[0] * corner[1]
  }, 0) / 2

/** Whether the point is inside the loop, by the ray test (a point on a wall goes to one side or the other). */
export function insideLoop(x: number, z: number, loop: Loop): boolean {
  let inside = false
  for (let i = 0, j = loop.length - 1; i < loop.length; j = i++) {
    const a = loop[i] as Planar
    const b = loop[j] as Planar
    if (a[1] > z !== b[1] > z && x < ((b[0] - a[0]) * (z - a[1])) / (b[1] - a[1]) + a[0]) inside = !inside
  }
  return inside
}

/** Inside the outline and outside every hole. */
export const insideOutline = (x: number, z: number, outline: Loop, holes: readonly Loop[] = []): boolean =>
  insideLoop(x, z, outline) && !holes.some((hole) => insideLoop(x, z, hole))

/** Which side of the line a→b the point c is on: 1, -1, or 0 when it is on it. */
function side(a: Planar, b: Planar, c: Planar): number {
  const turn = (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0])
  return Math.abs(turn) < EPSILON ? 0 : Math.sign(turn)
}

/** For a point known to be on the line a→b: whether it is between a and b. */
const between = (a: Planar, b: Planar, c: Planar): boolean =>
  Math.min(a[0], b[0]) - EPSILON <= c[0] &&
  c[0] <= Math.max(a[0], b[0]) + EPSILON &&
  Math.min(a[1], b[1]) - EPSILON <= c[1] &&
  c[1] <= Math.max(a[1], b[1]) + EPSILON

/** Whether the segments a→b and c→d have a point in common (a crossing, a touch, or an overlap). */
export function segmentsTouch(a: Planar, b: Planar, c: Planar, d: Planar): boolean {
  const [abc, abd, cda, cdb] = [side(a, b, c), side(a, b, d), side(c, d, a), side(c, d, b)]
  if (abc * abd < 0 && cda * cdb < 0) return true
  return (
    (abc === 0 && between(a, b, c)) ||
    (abd === 0 && between(a, b, d)) ||
    (cda === 0 && between(c, d, a)) ||
    (cdb === 0 && between(c, d, b))
  )
}

/** Two walls that share a corner `b` (a→b, then b→c) lie over each other when the second turns straight back. */
const foldsBack = (a: Planar, b: Planar, c: Planar): boolean =>
  side(a, b, c) === 0 && (b[0] - a[0]) * (c[0] - b[0]) + (b[1] - a[1]) * (c[1] - b[1]) < 0

/**
 * Whether two walls of the loop meet anywhere but at the corner they share: a crossing, a corner resting on another
 * wall, or a wall folded back over its neighbour. Walls that only continue each other in a straight line are fine.
 */
export function crossesItself(loop: Loop): boolean {
  const n = loop.length
  const at = (i: number): Planar => loop[i % n] as Planar
  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      if (j === i + 1) {
        if (foldsBack(at(i), at(j), at(j + 1))) return true
      } else if (i === 0 && j === n - 1) {
        if (foldsBack(at(j), at(0), at(1))) return true
      } else if (segmentsTouch(at(i), at(i + 1), at(j), at(j + 1))) return true
    }
  }
  return false
}

/**
 * Why a loop cannot be a sector's outline, in a sentence for the person drawing it; nothing when it can. Either
 * way round is fine: the document keeps the corners as they were drawn.
 */
export function outlineProblem(loop: Loop): string | undefined {
  if (loop.length < 3) return 'a sector needs at least three corners'
  for (let i = 0; i < loop.length; i++) {
    const corner = loop[i] as Planar
    if (!Number.isFinite(corner[0]) || !Number.isFinite(corner[1])) return `corner ${i} is not a point`
  }
  for (let i = 0; i < loop.length; i++) {
    const [j, here, there] = [(i + 1) % loop.length, loop[i] as Planar, loop[(i + 1) % loop.length] as Planar]
    if (here[0] === there[0] && here[1] === there[1]) return `corners ${i} and ${j} are the same point`
  }
  const [first, second] = [loop[0] as Planar, loop[1] as Planar]
  if (loop.every((corner) => side(first, second, corner) === 0)) return 'the outline has no area'
  if (crossesItself(loop)) return 'the outline crosses itself'
  return undefined
}
