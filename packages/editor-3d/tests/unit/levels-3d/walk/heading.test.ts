// The heading of the camera a level is played from (ED3D.4c, the 3D direction spec §4.2, M3R-D9 and D11): the game turns its
// camera freely, per pixel, and keeps the heading as an integer in turn units (65,536 to a turn, 0 looking toward +z and
// growing toward +x). The editor states a heading the way the game does, turns it by a drag, and looks at the dollhouse from
// any heading and from every 15 degrees of one, with what each cuts away or fades. Rooms are 8 m by 6 m and 4 m high.

import { degToHeading, TURN_UNITS, wrapHeading } from '@automata/3d/camera-view'
import { describe, expect, it } from 'vitest'
import {
  DEGREES_PER_PIXEL,
  dragTurn,
  headingSweep,
  headingToDeg,
  headingToYaw,
  headingView,
  wallsSeenFrom,
  yawToHeading,
} from '#src/features/levels-3d/walk/heading.ts'
import { fitOrbit, orbitCamera } from '#src/shared/geometry/camera-3d.ts'
import { EMPTY_BOUNDS, type SectorMesh } from '#src/shared/geometry/sector-mesh.ts'
import { entry, meshOf, room } from '#src/testing/room-mesh.ts'
import { toyAfSector } from '#src/testing/toy-af-sector.ts'

const DEGREES = Math.PI / 180
const SIZE = { w: 200, h: 130 }
const [QUARTER, HALF] = [TURN_UNITS / 4, TURN_UNITS / 2]
/** The heading whose eye is south-west of the room, looking north-east (compass bearing 45 degrees): 135 degrees. */
const SOUTH_WEST_EYE = 24_576

const countsAt = (mesh: SectorMesh, heading: number, options = {}) => {
  const { wallsCut, wallsFaded } = headingView(mesh, SIZE, heading, options)
  return [wallsCut, wallsFaded]
}

describe('the turn', () => {
  it('is the owner’s 65,536 units, and a pixel of drag is a quarter of a degree', () => {
    // Wrapping, turning and reading a yawDeg are @automata/3d's `camera-view`, tested there (M3.4b moved them).
    expect(TURN_UNITS).toBe(65_536)
    expect(DEGREES_PER_PIXEL).toBe(0.25)
  })

  it('turns by a drag: 1,440 pixels are a full turn, each pixel is a quarter degree, and the direction is the sign', () => {
    expect(dragTurn(1_440)).toBe(TURN_UNITS)
    expect(dragTurn(-1_440)).toBe(-TURN_UNITS)
    expect(dragTurn(360)).toBe(QUARTER)
    expect(dragTurn(0)).toBe(0)
    // A quarter degree is 45.51 units, so a pixel is worth 46 whole units.
    expect(dragTurn(1)).toBe(46)
    expect(dragTurn(-1)).toBe(-46)
  })

  it('scales a drag by the degrees a pixel is given', () => {
    expect(dragTurn(720, 0.5)).toBe(TURN_UNITS)
    expect(dragTurn(100, 0.5)).toBe(9_102)
    expect(dragTurn(90, 1)).toBe(QUARTER)
  })
})

describe('a heading and the editor camera', () => {
  it('maps the game headings to the compass bearing of the plan: 0 looks south, a quarter turn east, a half north', () => {
    expect(headingToYaw(0)).toBeCloseTo(Math.PI, 12)
    expect(headingToYaw(QUARTER)).toBeCloseTo(Math.PI / 2, 12)
    expect(headingToYaw(HALF)).toBe(0)
    expect(headingToYaw(3 * QUARTER)).toBeCloseTo((3 * Math.PI) / 2, 12)
    // Another way to say the same: the bearing is a half turn minus the heading.
    expect(headingToYaw(24_576) / DEGREES).toBeCloseTo(45, 9)
  })

  it('maps every unit to a bearing inside one turn, and every bearing back to the unit it came from', () => {
    for (let units = 0; units < TURN_UNITS; units++) {
      const yaw = headingToYaw(units)
      if (!(yaw >= 0 && yaw < 2 * Math.PI))
        throw new Error(`unit ${units}: bearing ${yaw} is outside one turn`)
      if (yawToHeading(yaw) !== units) throw new Error(`unit ${units}: came back as ${yawToHeading(yaw)}`)
    }
  })

  it('takes a bearing in any turn, whole or negative, to the heading it looks along', () => {
    // Looking east is a quarter turn of heading, however the bearing is spelled.
    expect(yawToHeading(Math.PI / 2)).toBe(QUARTER)
    expect(yawToHeading(Math.PI / 2 + 2 * Math.PI)).toBe(QUARTER)
    expect(yawToHeading(Math.PI / 2 - 2 * Math.PI)).toBe(QUARTER)
    expect(yawToHeading(-Math.PI / 2)).toBe(3 * QUARTER)
    expect(yawToHeading(0)).toBe(HALF)
  })

  it('writes a heading as the yawDeg a room carries: the same turn in degrees, four decimals', () => {
    expect(headingToDeg(0)).toBe(0)
    expect(headingToDeg(QUARTER)).toBe(90)
    expect(headingToDeg(HALF)).toBe(180)
    expect(headingToDeg(3 * QUARTER)).toBe(270)
    expect(headingToDeg(1)).toBe(0.0055)
    expect(headingToDeg(TURN_UNITS - 1)).toBe(359.9945)
    // A heading outside one turn is the one it wraps to.
    expect(headingToDeg(TURN_UNITS + QUARTER)).toBe(90)
    expect(headingToDeg(-QUARTER)).toBe(270)
  })

  it('round-trips every unit through the four decimals of a yawDeg', () => {
    for (let units = 0; units < TURN_UNITS; units++) {
      if (degToHeading(headingToDeg(units)) !== units)
        throw new Error(
          `unit ${units} -> ${headingToDeg(units)} degrees -> ${degToHeading(headingToDeg(units))}`,
        )
    }
  })
})

describe('wallsSeenFrom', () => {
  const sorted = (selections: readonly string[]): string[] => [...selections].sort()

  it('names the walls an eye is behind: a room seen from the south-west loses its south and west walls', () => {
    const seen = wallsSeenFrom(room(), [-10, 8, 20])
    expect(sorted(seen.cut)).toEqual(['wall:room/2', 'wall:room/3'])
    expect(seen.faded).toEqual([])
  })

  it('cuts nothing from an eye inside the room, which every wall faces', () => {
    expect(wallsSeenFrom(room(), [4, 1.6, 3])).toEqual({ cut: [], faded: [] })
  })

  it('shows a wall that says never, and fades one that says fade, where it would be cut', () => {
    const mesh = room({ 2: { occlude: 'never' }, 3: { occlude: 'fade' } })
    expect(wallsSeenFrom(mesh, [-10, 8, 20])).toEqual({ cut: [], faded: ['wall:room/3'] })
  })

  it('names a wall once when a door makes it several surfaces', () => {
    const mesh = room({ 2: { door: { at: 4, width: 1, height: 2 } } })
    expect(mesh.surfaces.filter((surface) => surface.selection === 'wall:room/2').length).toBeGreaterThan(1)
    expect(sorted(wallsSeenFrom(mesh, [-10, 8, 20]).cut)).toEqual(['wall:room/2', 'wall:room/3'])
  })

  it('names a wall with no selection by the one surface it is', () => {
    const bare = room()
    const unselected = {
      ...bare,
      surfaces: bare.surfaces.map((surface) => ({ ...surface, selection: undefined })),
    }
    const named = (selection: string): string =>
      `surface#${bare.surfaces.findIndex((surface) => surface.selection === selection)}`
    expect(sorted(wallsSeenFrom(unselected, [-10, 8, 20]).cut)).toEqual(
      [named('wall:room/2'), named('wall:room/3')].sort(),
    )
  })

  it('leaves out the floor and the ceiling, which an eye below or above the room sees from behind', () => {
    // From under the floor the floor faces away, and from over the roof the ceiling does; neither is a wall to cut.
    expect(wallsSeenFrom(room(), [4, -30, 3])).toEqual({ cut: [], faded: [] })
    expect(wallsSeenFrom(room(), [4, 30, 3])).toEqual({ cut: [], faded: [] })
    // The mesh draws a floor with `never`, so it is never cut; a floor that said `cut` would still not be counted as a wall.
    const bare = room()
    const cuttable = {
      ...bare,
      surfaces: bare.surfaces.map((surface) =>
        surface.role === 'floor' ? { ...surface, occlude: 'cut' as const } : surface,
      ),
    }
    expect(wallsSeenFrom(cuttable, [4, -30, 3])).toEqual({ cut: [], faded: [] })
  })
})

describe('headingView', () => {
  it('frames the level from the heading: the orbit is fitOrbit at that heading’s bearing, and the camera looks through it', () => {
    const mesh = room()
    const options = { pitch: 40 * DEGREES, padding: 10 }
    for (const heading of [0, 1, QUARTER, SOUTH_WEST_EYE, HALF + 7, TURN_UNITS - 1]) {
      const view = headingView(mesh, SIZE, heading, options)
      expect(view.heading).toBe(heading)
      expect(view.orbit).toEqual(
        fitOrbit(mesh.bounds, SIZE, { yaw: headingToYaw(heading), pitch: 40 * DEGREES, padding: 10 }),
      )
      expect(view.camera).toEqual(orbitCamera(view.orbit))
    }
  })

  it('wraps a heading it is given into one turn, and says the wrapped one', () => {
    const view = headingView(room(), SIZE, TURN_UNITS + 5)
    expect(view.heading).toBe(5)
    expect(view.orbit.yaw).toBe(headingToYaw(5))
  })

  it('counts the walls cut away by the way the heading faces them: two at a corner view, one square on', () => {
    // Every 45 degrees of heading, from south. At 0 the eye is north of the room looking south: it loses the north wall.
    const eight = Array.from({ length: 8 }, (_, k) => countsAt(room(), (k * TURN_UNITS) / 8))
    expect(eight).toEqual([
      [1, 0], //   0: looking south from the north: the north wall
      [2, 0], //  45: looking south-east from the north-west: the north and west walls
      [1, 0], //  90: looking east from the west: the west wall
      [2, 0], // 135: looking north-east from the south-west: the south and west walls
      [1, 0], // 180
      [2, 0], // 225
      [1, 0], // 270
      [2, 0], // 315
    ])
  })

  it('never counts a wall that says never, however it faces', () => {
    // At 135 degrees the eye is south-west, so the south wall and the west wall are cut: never keeps the south one.
    expect(countsAt(room({ 2: { occlude: 'never' } }), SOUTH_WEST_EYE)).toEqual([1, 0])
    expect(countsAt(room({ 2: { occlude: 'never' }, 3: { occlude: 'never' } }), SOUTH_WEST_EYE)).toEqual([
      0, 0,
    ])
  })

  it('counts a wall that says fade as faded, not cut', () => {
    expect(countsAt(room({ 3: { occlude: 'fade' } }), SOUTH_WEST_EYE)).toEqual([1, 1])
    expect(countsAt(room({ 2: { occlude: 'fade' }, 3: { occlude: 'fade' } }), SOUTH_WEST_EYE)).toEqual([0, 2])
  })

  it('counts a wall once when a door makes it several surfaces', () => {
    const mesh = room({ 2: { door: { at: 4, width: 1, height: 2 } } })
    expect(countsAt(mesh, SOUTH_WEST_EYE)).toEqual([2, 0])
  })

  it('counts a wall that is a portal, which is a lower and an upper surface and no wall one', () => {
    // 'a' is 0 to 4 m and 'b' next to it is 1 to 3 m, so a's east wall is a step below and a header above the opening.
    const a = entry('a', [0, 0, 8, 6], { 1: { next: 'b' } })
    const b = { ...entry('b', [8, 0, 16, 6], { 3: { next: 'a' } }), floor: 1, ceiling: 3 }
    const mesh = meshOf(toyAfSector({ sectors: [a, b] }))
    expect(
      mesh.surfaces.filter((surface) => surface.selection === 'wall:a/1').map((surface) => surface.role),
    ).toEqual(['lower', 'upper'])
    // Looking west from the east (a heading of 270 degrees): b's east wall and a's east one (seen from behind) are cut away.
    expect(countsAt(mesh, 3 * QUARTER)).toEqual([2, 0])
  })

  it('counts a wall with no selection as the one surface it is', () => {
    const bare = room()
    const unselected = {
      ...bare,
      surfaces: bare.surfaces.map((surface) => ({ ...surface, selection: undefined })),
    }
    expect(countsAt(unselected, SOUTH_WEST_EYE)).toEqual([2, 0])
  })

  it('counts neither the floor nor the ceiling', () => {
    const open = headingSweep(room(), SIZE, 15, { pitch: 85 * DEGREES })
    expect(open.every((view) => view.wallsCut <= 2)).toBe(true)
  })

  it('gives the empty frame, which cuts and fades nothing, for a level with no sectors', () => {
    const empty = meshOf(toyAfSector({ sectors: [] }))
    expect(empty.bounds).toEqual(EMPTY_BOUNDS)
    const views = headingSweep(empty, SIZE)
    expect(views).toHaveLength(24)
    expect(views.map((view) => [view.wallsCut, view.wallsFaded])).toEqual(Array(24).fill([0, 0]))
    expect(views[0]?.orbit).toEqual(fitOrbit(EMPTY_BOUNDS, SIZE, { yaw: headingToYaw(0) }))
  })
})

describe('headingSweep', () => {
  it('gives a view every 15 degrees: 24 of them, numbered by their units, which are 2,730 or 2,731 apart', () => {
    const views = headingSweep(room(), SIZE)
    const headings = views.map((view) => view.heading)
    expect(views).toHaveLength(24)
    expect(headings.slice(0, 5)).toEqual([0, 2_731, 5_461, 8_192, 10_923])
    for (const [k, heading] of headings.entries()) {
      const next = headings[(k + 1) % headings.length] as number
      expect([2_730, 2_731]).toContain(wrapHeading(next - heading))
    }
    expect(new Set(headings).size).toBe(24)
  })

  it('hits every 45 degrees exactly, so the eight old views are among the 24', () => {
    const headings = headingSweep(room(), SIZE).map((view) => view.heading)
    for (let k = 0; k < 8; k++) expect(headings).toContain((k * TURN_UNITS) / 8)
  })

  it('makes each view the one headingView makes for that heading, with the pitch and the padding given', () => {
    const mesh = room({ 3: { occlude: 'fade' } })
    const options = { pitch: 40 * DEGREES, padding: 10 }
    for (const view of headingSweep(mesh, SIZE, 15, options)) {
      expect(view).toEqual(headingView(mesh, SIZE, view.heading, options))
    }
  })

  it('starts at the heading it is given, and keeps every heading inside one turn', () => {
    const views = headingSweep(room(), SIZE, 15, { from: 60_000 })
    expect(views[0]?.heading).toBe(60_000)
    expect(views[1]?.heading).toBe(wrapHeading(60_000 + 2_731))
    expect(views.every((view) => view.heading >= 0 && view.heading < TURN_UNITS)).toBe(true)
    expect(new Set(views.map((view) => view.heading)).size).toBe(24)
  })

  it('takes any step that divides a turn: 45 degrees gives eight views and 90 gives four', () => {
    expect(headingSweep(room(), SIZE, 45).map((view) => view.heading)).toEqual([
      0, 8_192, 16_384, 24_576, 32_768, 40_960, 49_152, 57_344,
    ])
    expect(headingSweep(room(), SIZE, 90).map((view) => view.heading)).toEqual([0, 16_384, 32_768, 49_152])
    expect(headingSweep(room(), SIZE, 360).map((view) => view.heading)).toEqual([0])
  })

  it('counts the same walls the eight old headings did, from the old home heading', () => {
    const counts = headingSweep(room(), SIZE, 45, { from: SOUTH_WEST_EYE }).map((view) => [
      view.wallsCut,
      view.wallsFaded,
    ])
    expect(counts).toEqual([
      [2, 0],
      [1, 0],
      [2, 0],
      [1, 0],
      [2, 0],
      [1, 0],
      [2, 0],
      [1, 0],
    ])
  })

  it('refuses a step that does not divide a turn, or is not a step, with the sentence', () => {
    expect(() => headingSweep(room(), SIZE, 7)).toThrow('a step of 7 degrees does not divide a turn')
    expect(() => headingSweep(room(), SIZE, 0)).toThrow('a step of 0 degrees does not divide a turn')
    expect(() => headingSweep(room(), SIZE, -15)).toThrow('a step of -15 degrees does not divide a turn')
    expect(() => headingSweep(room(), SIZE, 720)).toThrow('a step of 720 degrees does not divide a turn')
    expect(() => headingSweep(room(), SIZE, Number.NaN)).toThrow('does not divide a turn')
  })
})
