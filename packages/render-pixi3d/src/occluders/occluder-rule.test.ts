// The occluder rule's geometry (M3 spec §4.2): which side of a wall's inside face a point is on, whether the camera's
// line to the player crosses a wall (The Last Light `src/game/cutaway.ts` `wallHidden` at 92e6704), and whether a
// segment crosses a prop's bounds. The last describe block ports The Last Light's `tests/cutaway.test.ts` onto an
// equivalent fixture: its clinic map is The Last Light's content, not AF's.
import { describe, expect, it } from 'vitest'
import {
  FIGURE_REACH,
  lineCrossesWall,
  ON_THE_LINE,
  propOcclude,
  segmentHitsBox,
  type WallSpan,
  wallFacesAway,
  wallSide,
} from './occluder-rule.js'

// Along +x from the origin, 4 m long and 2.5 m high: its inside (the room) is +z, on the left of a → b.
const SOUTH: WallSpan = { a: { x: 0, z: 0 }, b: { x: 4, z: 0 }, height: 2.5 }
const at = (x: number, y: number, z: number) => ({ x, y, z })

describe('wallSide and wallFacesAway', () => {
  it('measures metres from the inside face, positive in the room (inward normal on the left of a → b)', () => {
    expect(wallSide(SOUTH, at(2, 1, 1.5))).toBeCloseTo(1.5, 12)
    expect(wallSide(SOUTH, at(2, 1, -2))).toBeCloseTo(-2, 12)
    const west: WallSpan = { a: { x: 0, z: 4 }, b: { x: 0, z: 0 }, height: 2.5 }
    expect(wallSide(west, at(1, 0, 2))).toBeCloseTo(1, 12)
  })

  it('faces away from an eye on its outer side, and from one edge-on; not from one in the room', () => {
    expect(wallFacesAway(SOUTH, at(2, 3, -1))).toBe(true)
    expect(wallFacesAway(SOUTH, at(9, 3, 0))).toBe(true)
    expect(wallFacesAway(SOUTH, at(2, 3, 0.01))).toBe(false)
  })
})

describe('lineCrossesWall', () => {
  it('is true when the segment crosses the inside face within the wall’s span and below its top', () => {
    expect(lineCrossesWall(SOUTH, at(2, 1, 3), at(2, 1, -1))).toBe(true)
    expect(lineCrossesWall(SOUTH, at(2, 1, -1), at(2, 1, 3))).toBe(true)
  })

  it(`still counts within ${FIGURE_REACH} m past an end (a figure's half-width and some), not beyond`, () => {
    expect(lineCrossesWall(SOUTH, at(-0.5, 1, 1), at(-0.5, 1, -1))).toBe(true)
    expect(lineCrossesWall(SOUTH, at(4.5, 1, 1), at(4.5, 1, -1))).toBe(true)
    expect(lineCrossesWall(SOUTH, at(-0.7, 1, 1), at(-0.7, 1, -1))).toBe(false)
    expect(lineCrossesWall(SOUTH, at(4.7, 1, 1), at(4.7, 1, -1))).toBe(false)
  })

  it('passes over a wall’s top and stops short of a wall it does not reach', () => {
    expect(lineCrossesWall(SOUTH, at(2, 4, 1), at(2, 3, -1))).toBe(false)
    expect(lineCrossesWall(SOUTH, at(2, 1, 3), at(2, 1, 0.5))).toBe(false)
  })

  it('counts a line that passes over the face’s top and comes down through the wall’s thickness', () => {
    const thick: WallSpan = { ...SOUTH, thickness: 0.2 }
    // Over the inside face at y 2.54, then through the top of the solid between z 0 and −0.2.
    expect(lineCrossesWall(thick, at(2, 3.6, 0.5), at(2, 0, -1.2))).toBe(true)
    expect(lineCrossesWall(SOUTH, at(2, 3.6, 0.5), at(2, 0, -1.2))).toBe(false)
  })

  it(`does not count an end within ${ON_THE_LINE} m of the wall's line: a player standing in its doorway`, () => {
    expect(lineCrossesWall(SOUTH, at(2, 3, 3), at(2, 0, -0.1))).toBe(false)
  })
})

describe('the doorway guard through a thick wall (review of #249, 4)', () => {
  // 0.2 m walls either side of a doorway: a player anywhere across the doorway's depth is in it, not behind a piece.
  const left: WallSpan = { a: { x: -4, z: 0 }, b: { x: -0.5, z: 0 }, height: 2.5, thickness: 0.2 }
  const right: WallSpan = { a: { x: 0.5, z: 0 }, b: { x: 4, z: 0 }, height: 2.5, thickness: 0.2 }
  const eye = at(0, 3.1, 4.5)

  it('cuts neither piece while the player stands anywhere in the doorway, from the inside face to the outside one', () => {
    for (const z of [0.05, -0.05, -0.1, -0.15, -0.2, -0.25, -0.3])
      for (const y of [0, 1.62]) {
        expect(lineCrossesWall(left, eye, at(0, y, z))).toBe(false)
        expect(lineCrossesWall(right, eye, at(0, y, z))).toBe(false)
      }
  })

  it('still cuts a piece the player stands behind, past the solid', () => {
    expect(lineCrossesWall(right, eye, at(1.2, 0, -0.5))).toBe(true)
  })
})

describe('wall spans', () => {
  it('refuses a wall whose ends are the same point (review of #249, 13)', () => {
    const point: WallSpan = { a: { x: 1, z: 1 }, b: { x: 1, z: 1 }, height: 2 }
    expect(() => wallSide(point, at(0, 0, 0))).toThrow(/a and b are the same point/)
  })
})

describe('segmentHitsBox', () => {
  const pillar = { min: [1, 0, 1], max: [1.5, 2.4, 1.5] } as const
  it('is true through the box, false beside it, short of it or past it', () => {
    expect(segmentHitsBox(at(0, 1, 0), at(3, 1, 3), pillar)).toBe(true)
    expect(segmentHitsBox(at(0, 1, 0), at(3, 1, 0), pillar)).toBe(false)
    expect(segmentHitsBox(at(0, 1, 0), at(0.9, 1, 0.9), pillar)).toBe(false)
    expect(segmentHitsBox(at(2, 1, 2), at(3, 1, 3), pillar)).toBe(false)
    expect(segmentHitsBox(at(0, 3, 0), at(3, 3, 3), pillar)).toBe(false)
  })

  it('is true for a segment that starts inside, and for one parallel to a face and inside the slab', () => {
    expect(segmentHitsBox(at(1.2, 1, 1.2), at(5, 1, 5), pillar)).toBe(true)
    expect(segmentHitsBox(at(1.2, 1, -1), at(1.2, 1, 5), pillar)).toBe(true)
    expect(segmentHitsBox(at(0.9, 1, -1), at(0.9, 1, 5), pillar)).toBe(false)
  })
})

describe('propOcclude', () => {
  it('is what the prop says, else fade above 1.5 m and never at or below it (§4.2)', () => {
    expect(propOcclude({ min: [0, 0, 0], max: [1, 1.6, 1] }, undefined)).toBe('fade')
    expect(propOcclude({ min: [0, 0, 0], max: [1, 1.5, 1] }, undefined)).toBe('never')
    expect(propOcclude({ min: [0, 0, 0], max: [1, 0.8, 1] }, 'cut')).toBe('cut')
  })
})

// The Last Light's cut-away cases (`tests/cutaway.test.ts`): the hall camera, high and south of the room, looks
// north. Here a counter wall runs x 0..0.8 along z 1.2, and the hall's back wall runs along z −1.6 (the hall, +z, on
// its inside) in two pieces either side of a corridor mouth at x −0.2..1.0.
describe('The Last Light’s cut-away cases, ported', () => {
  const HALL_CAMERA = at(0, 9.4, 15.25)
  const counter: WallSpan = { a: { x: 0, z: 1.2 }, b: { x: 0.8, z: 1.2 }, height: 1.1 }
  const northWest: WallSpan = { a: { x: -4, z: -1.6 }, b: { x: -0.2, z: -1.6 }, height: 2.5 }
  const northEast: WallSpan = { a: { x: 1.0, z: -1.6 }, b: { x: 4, z: -1.6 }, height: 2.5 }

  it('keeps the back wall while the player walks through the corridor mouth', () => {
    for (const z of [-1.55, -1.6, -1.65]) {
      expect(lineCrossesWall(northEast, HALL_CAMERA, at(0.4, 0, z))).toBe(false)
      expect(lineCrossesWall(northWest, HALL_CAMERA, at(0.4, 0, z))).toBe(false)
    }
  })

  it('keeps a wall the view passes in open floor', () => {
    expect(lineCrossesWall(counter, HALL_CAMERA, at(2.4, 0, 1.0))).toBe(false)
  })

  it('still cuts the wall the player stands behind', () => {
    expect(lineCrossesWall(northEast, HALL_CAMERA, at(3.2, 0, -2.2))).toBe(true)
    expect(lineCrossesWall(northEast, HALL_CAMERA, at(1.7, 0, -2.2))).toBe(true)
  })
})
