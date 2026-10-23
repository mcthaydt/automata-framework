// The door half of Last Light's `openings` check (`doors`, scripts/pipeline/blockout-lib.ts, 92e6704): an opening's door
// box is a door box and straddles the opening's line, inside its span.
import { describe, expect, it } from 'vitest'
import type { Blockout } from '../../format/blockout.schema'
import { expand } from '../../format/expand'
import { toyBlockout, toyDoor, toyOpening, toyRoom } from '../../testing/toy-blockout'
import { doorProblems } from './doors'

const problems = (blockout: Blockout) => doorProblems(blockout, expand(blockout))
const moved = (more: object) => toyBlockout({ boxes: [{ ...toyDoor, ...more }] })

describe('doorProblems', () => {
  it('passes a door that straddles its opening, and an opening with no door', () => {
    expect(problems(toyBlockout())).toEqual([])
    expect(problems(toyBlockout({ openings: [{ ...toyOpening, door: undefined }], boxes: [] }))).toEqual([])
  })

  it("fails a door that names no box, and one that names a box that is no door, locating the opening's connector", () => {
    const missing = problems(toyBlockout({ openings: [{ ...toyOpening, door: 'ghost' }] }))
    expect(missing.map((problem) => problem.message)).toEqual(['opening ab: ghost is not a door box'])
    expect(missing[0]?.locator).toEqual({ selection: 'sector:ab', at: undefined })
    expect(missing[0]?.related).toEqual([])

    const crate = { ...toyDoor, id: 'crate', kind: 'furniture' as const, role: 'collider' as const }
    const found = problems(toyBlockout({ openings: [{ ...toyOpening, door: 'crate' }], boxes: [crate] }))
    expect(found.map((problem) => problem.message)).toEqual(['opening ab: crate is not a door box'])
    expect(found[0]?.related).toEqual([{ selection: 'entity:box/crate', at: { x: 4.0625, z: 2 } }])
  })

  it('fails a door that is away from its line, and one that is away from its throat', () => {
    for (const [what, more] of [
      ['a door off the line', { z: 2.5, x: 5 }],
      ['a door beside the connector', { x: 9 }],
    ] as const) {
      const [problem, ...rest] = problems(moved(more))
      expect(rest, what).toEqual([])
      expect(problem?.message, what).toBe('opening ab: door abDoor does not straddle it')
      expect(problem?.locator?.selection, what).toBe('sector:ab')
      expect(problem?.related, what).toEqual([
        { selection: 'entity:box/abDoor', at: { x: more.x ?? 4.0625, z: 'z' in more ? more.z : 2 } },
      ])
    }
  })

  it('lets a door sit within 5 cm of the middle of the span, along either axis, and not beyond', () => {
    expect(problems(moved({ z: 2.04 }))).toEqual([])
    expect(problems(moved({ z: 2.06 }))).toHaveLength(1)
    expect(problems(moved({ z: 2.06 }))[0]?.message).toBe('opening ab: door abDoor does not straddle it')
    // A door whose x is the span's middle counts as on the line, whatever the wall's axis (Last Light cannot tell): the
    // throat check is what catches this one, being nowhere near the connector.
    expect(problems(moved({ x: 2, z: 7 }))).toHaveLength(1)
  })

  it("takes a door within 0.2 m of the connector's corners as inside it, counting half its width and half its depth", () => {
    // The connector's corners are at x 4 and 4.125 and z 1.5 and 2.5. The door is 0.12 wide, so it reaches 0.06 each side
    // of its x, and 0.2 m more is allowed.
    expect(problems(moved({ x: 4.0625 + 0.3 }))).toEqual([])
    expect(problems(moved({ x: 4.0625 + 0.35 }))).toHaveLength(1)
    // A door 0.5 m deep reaches 0.25 each side of z = 2, which with 0.2 more does not reach the corners 0.5 away; 0.7 does.
    expect(problems(moved({ d: 0.7 }))).toEqual([])
    expect(problems(moved({ d: 0.5 }))).toHaveLength(1)
  })

  it("reads an opening in an east-west wall by the door's x as well: either axis within 5 cm of the middle will do", () => {
    // Rooms stacked north and south, meeting at z = 4 with no connector; the opening's span runs along x.
    const stacked = (door: object) =>
      toyBlockout({
        rooms: [
          toyRoom('a'),
          {
            ...toyRoom('b'),
            corners: [
              [0, 4],
              [4, 4],
              [4, 8],
              [0, 8],
            ],
          },
        ],
        boxes: [{ ...toyDoor, w: 1, d: 0.12, x: 2, z: 4, ...door }],
      })
    expect(problems(stacked({}))).toEqual([])
    expect(problems(stacked({ x: 2.04 }))).toEqual([])
    expect(problems(stacked({ x: 2.06 }))).toHaveLength(1)
    expect(problems(stacked({ x: 1.96 }))).toEqual([])
    expect(problems(stacked({ x: 1.94 }))).toHaveLength(1)
  })

  it('does not look for a connector where the rooms meet at one wall: the door only has to be on the line', () => {
    const direct = toyBlockout({
      rooms: [
        toyRoom('a'),
        {
          ...toyRoom('b'),
          corners: [
            [4, 0],
            [7, 0],
            [7, 4],
            [4, 4],
          ],
        },
      ],
      boxes: [{ ...toyDoor, x: 4 }],
    })
    expect(problems(direct)).toEqual([])
    expect(problems({ ...direct, boxes: [{ ...toyDoor, x: 9 }] })).toEqual([])
    expect(problems({ ...direct, boxes: [{ ...toyDoor, x: 4, z: 3 }] })[0]?.locator).toEqual({
      selection: 'entity:box/abDoor',
      at: { x: 4, z: 3 },
    })
  })
})
