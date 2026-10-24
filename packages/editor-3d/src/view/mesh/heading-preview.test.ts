// The eight headings of the camera a level is played from (ED3D.4b step 4, the 3D direction spec §4.2): the dollhouse seen
// from the home heading and from each quarter-quarter turn after it, with what each cuts away or fades, so the designer sees
// what a sector's walls do in all eight before the game turns the camera. Rooms are 8 m by 6 m and 4 m high.
import { describe, expect, it } from 'vitest'
import type { AfSector, AfSectorEntry, AfWall } from '../../format/af-sector.schema'
import { afSectorProfile } from '../../profile/af-sector-profile'
import { toyAfSector } from '../../testing/toy-af-sector'
import { selectionOf } from '../selection-of'
import { fitOrbit, HOME_YAW, orbitCamera } from './camera-3d'
import { HEADINGS, headingPreview } from './heading-preview'
import { buildSectorMesh, EMPTY_BOUNDS, type SectorMesh } from './sector-mesh'

const DEGREES = Math.PI / 180
const SIZE = { w: 200, h: 130 }

const entry = (
  id: string,
  [x0, z0, x1, z1]: readonly [number, number, number, number],
  walls: Readonly<Record<number, AfWall>> = {},
): AfSectorEntry => ({
  id,
  floor: 0,
  ceiling: 4,
  light: 1,
  corners: [
    [x0, z0, walls[0]],
    [x1, z0, walls[1]],
    [x1, z1, walls[2]],
    [x0, z1, walls[3]],
  ],
})

const meshOf = (data: AfSector): SectorMesh =>
  buildSectorMesh(afSectorProfile.geometry(data).layers, selectionOf(afSectorProfile, data))

/** One room, 'room', from the origin to (8, 6): its walls are 0 north, 1 east, 2 south and 3 west. */
const room = (walls: Readonly<Record<number, AfWall>> = {}): SectorMesh =>
  meshOf(toyAfSector({ sectors: [entry('room', [0, 0, 8, 6], walls)] }))

const counts = (mesh: SectorMesh, options = {}) =>
  headingPreview(mesh, SIZE, options).map(({ wallsCut, wallsFaded }) => [wallsCut, wallsFaded])

describe('headingPreview', () => {
  it('gives eight views, numbered from 0, which start at the home heading and turn an eighth of a turn each', () => {
    const views = headingPreview(room(), SIZE)
    expect(HEADINGS).toBe(8)
    expect(views.map((view) => view.heading)).toEqual([0, 1, 2, 3, 4, 5, 6, 7])
    expect(views.map((view) => view.orbit.yaw / DEGREES)).toEqual(
      [45, 90, 135, 180, 225, 270, 315, 0].map((degrees) => expect.closeTo(degrees, 9)),
    )
    expect(HOME_YAW).toBe(45 * DEGREES)
  })

  it('starts at the heading it is given, and keeps every yaw inside one turn', () => {
    const views = headingPreview(room(), SIZE, { yaw: 300 * DEGREES })
    expect(views.map((view) => view.orbit.yaw / DEGREES)).toEqual(
      [300, 345, 30, 75, 120, 165, 210, 255].map((degrees) => expect.closeTo(degrees, 9)),
    )
  })

  it('frames each view with fitOrbit at its yaw, with the pitch and the padding given, and looks through the orbit camera', () => {
    const mesh = room()
    const options = { pitch: 40 * DEGREES, padding: 10 }
    headingPreview(mesh, SIZE, options).forEach((view) => {
      expect(view.orbit).toEqual(
        fitOrbit(mesh.bounds, SIZE, { yaw: view.orbit.yaw, pitch: 40 * DEGREES, padding: 10 }),
      )
      expect(view.camera).toEqual(orbitCamera(view.orbit))
    })
  })

  it('counts the walls cut away, by the way each heading faces them: two at a corner view, one square on', () => {
    expect(counts(room())).toEqual([
      [2, 0], // looking north-east from the south-west: the south and west walls
      [1, 0], // looking east from the west: the west wall
      [2, 0], // looking south-east from the north-west: the north and west walls
      [1, 0],
      [2, 0],
      [1, 0],
      [2, 0],
      [1, 0],
    ])
  })

  it('never counts a wall that says never, however it faces', () => {
    // At heading 0 the eye is south-west, so the south wall and the west wall are cut: never keeps the south one.
    expect(counts(room({ 2: { occlude: 'never' } }))[0]).toEqual([1, 0])
    expect(counts(room({ 2: { occlude: 'never' }, 3: { occlude: 'never' } }))[0]).toEqual([0, 0])
  })

  it('counts a wall that says fade as faded, not cut', () => {
    expect(counts(room({ 3: { occlude: 'fade' } }))[0]).toEqual([1, 1])
    expect(counts(room({ 2: { occlude: 'fade' }, 3: { occlude: 'fade' } }))[0]).toEqual([0, 2])
  })

  it('counts a wall once when a door makes it several surfaces', () => {
    const mesh = room({ 2: { door: { at: 4, width: 1, height: 2 } } })
    expect(mesh.surfaces.filter((surface) => surface.selection === 'wall:room/2').length).toBeGreaterThan(1)
    expect(counts(mesh)[0]).toEqual([2, 0])
  })

  it('counts a wall that is a portal, which is a lower and an upper surface and no wall one', () => {
    // 'a' is 0 to 4 m and 'b' next to it is 1 to 3 m, so a's east wall is a step below and a header above the opening.
    const a = entry('a', [0, 0, 8, 6], { 1: { next: 'b' } })
    const b = { ...entry('b', [8, 0, 16, 6], { 3: { next: 'a' } }), floor: 1, ceiling: 3 }
    const mesh = meshOf(toyAfSector({ sectors: [a, b] }))
    expect(
      mesh.surfaces.filter((surface) => surface.selection === 'wall:a/1').map((surface) => surface.role),
    ).toEqual(['lower', 'upper'])
    // Heading 5 looks west from the east: b's east wall and a's east one (seen from behind) are cut away.
    expect(counts(mesh)[5]).toEqual([2, 0])
  })

  it('counts a wall with no selection as the one surface it is', () => {
    const bare = room()
    const unselected = {
      ...bare,
      surfaces: bare.surfaces.map((surface) => ({ ...surface, selection: undefined })),
    }
    expect(counts(unselected)[0]).toEqual([2, 0])
  })

  it('counts neither the floor nor the ceiling', () => {
    const open = headingPreview(room(), SIZE, { pitch: 85 * DEGREES })
    expect(open.every((view) => view.wallsCut <= 2)).toBe(true)
  })

  it('gives eight views of the empty frame, which cut and fade nothing, for a level with no sectors', () => {
    const empty = meshOf(toyAfSector({ sectors: [] }))
    expect(empty.bounds).toEqual(EMPTY_BOUNDS)
    const views = headingPreview(empty, SIZE)
    expect(views).toHaveLength(8)
    expect(views.map((view) => [view.wallsCut, view.wallsFaded])).toEqual(Array(8).fill([0, 0]))
    expect(views[0]?.orbit).toEqual(fitOrbit(EMPTY_BOUNDS, SIZE, { yaw: HOME_YAW }))
  })
})
