// The follow camera of a room (ED3D.4c, the 3D direction spec §4.2, M3R-D9 and D11): 24 mm, 25 degrees down and 5 m back from
// a focus a metre above the followed position, along a heading the player turns freely. The editor draws a room as the player
// sees it: the eye the game would put there, and the walls that eye cuts away. `bounds`, `lag` easing and lock-on framing
// are the game renderer's; the editor carries `lag` as data only. The view itself (its fields, defaults and ranges) is
// render-pixi3d's `camera-view`, whose own tests cover it.

import { cameraView, TURN_UNITS } from '@mcthaydt/automata-render-pixi3d/camera-view'
import { describe, expect, it } from 'vitest'
import { room } from '../../testing/room-mesh'
import { forward, ORBIT_FOV, orbitCamera, projectPoint } from './camera-3d'
import { followCamera, roomView } from './follow-camera'
import { headingToYaw } from './heading'
import type { Vec3 } from './sector-mesh'

const DEGREES = Math.PI / 180
const SIZE = { w: 200, h: 130 }
const [QUARTER, HALF] = [TURN_UNITS / 4, TURN_UNITS / 2]
/** The player in the middle of the 8 m by 6 m room, on the floor. */
const MIDDLE: Vec3 = [4, 0, 3]

describe('followCamera', () => {
  it('stands 2.11 m above the focus and 4.53 m behind it at the defaults, 3.1 m above the floor, and looks 25 degrees down', () => {
    const camera = followCamera(cameraView('view'), [0, 0, 0], 0)
    // Heading 0 looks toward +z, so the eye is behind the player at -z.
    expect(camera.eye[0]).toBeCloseTo(0, 9)
    expect(camera.eye[1] - 1).toBeCloseTo(2.113, 3)
    expect(camera.eye[1]).toBeCloseTo(3.113, 3)
    expect(camera.eye[2]).toBeCloseTo(-4.532, 3)
    expect(camera.pitch).toBeCloseTo(-25 * DEGREES, 12)
  })

  it('looks through the 24 mm lens: 53.13 degrees', () => {
    const camera = followCamera(cameraView('view'), MIDDLE, 0)
    expect(camera.fov).toBe(ORBIT_FOV)
    expect(camera.fov / DEGREES).toBeCloseTo(53.13, 2)
  })

  it('looks at the focus, which is the followed position raised by the focus height, from the distance', () => {
    const spec = cameraView('view', { distance: 8, focusHeight: 1.5, tiltDeg: 40 })
    const followed: Vec3 = [10, 2, -3]
    const camera = followCamera(spec, followed, 12_345)
    const hit = projectPoint(camera, SIZE, [10, 3.5, -3])
    expect(hit?.x).toBeCloseTo(SIZE.w / 2, 6)
    expect(hit?.y).toBeCloseTo(SIZE.h / 2, 6)
    expect(hit?.depth).toBeCloseTo(8, 9)
    // The eye is 8 m from the focus, 40 degrees above it.
    expect(camera.eye[1] - 3.5).toBeCloseTo(8 * Math.sin(40 * DEGREES), 9)
  })

  it('stands behind the player at every quarter heading: the eye is on the side the heading looks away from', () => {
    const behind = (heading: number): Vec3 => followCamera(cameraView('view'), [0, 0, 0], heading).eye
    const [south, east, north, west] = [0, QUARTER, HALF, 3 * QUARTER].map(behind) as [Vec3, Vec3, Vec3, Vec3]
    expect(south[2]).toBeLessThan(-4)
    expect(east[0]).toBeLessThan(-4)
    expect(north[2]).toBeGreaterThan(4)
    expect(west[0]).toBeGreaterThan(4)
    for (const eye of [south, north]) expect(eye[0]).toBeCloseTo(0, 9)
    for (const eye of [east, west]) expect(eye[2]).toBeCloseTo(0, 9)
  })

  it('looks along the heading’s direction (sin h, cos h) in (x, z), at any heading', () => {
    for (const heading of [0, 1, 4_096, QUARTER, 30_000, HALF, 50_000, 3 * QUARTER, TURN_UNITS - 1]) {
      const turns = (heading / TURN_UNITS) * 2 * Math.PI
      const [x, , z] = forward(followCamera(cameraView('view'), MIDDLE, heading))
      const level = Math.cos(25 * DEGREES)
      expect(x).toBeCloseTo(Math.sin(turns) * level, 9)
      expect(z).toBeCloseTo(Math.cos(turns) * level, 9)
    }
  })

  it('is the dollhouse’s orbit camera with the view’s numbers', () => {
    const spec = cameraView('view', { tiltDeg: 33, distance: 6, focusHeight: 0.5 })
    expect(followCamera(spec, [1, 2, 3], 7_777)).toEqual(
      orbitCamera({ target: [1, 2.5, 3], distance: 6, yaw: headingToYaw(7_777), pitch: 33 * DEGREES }),
    )
  })
})

describe('roomView', () => {
  const view = (heading?: number, given = {}, followed: Vec3 = MIDDLE) =>
    roomView(room(), cameraView('view', given), followed, heading)
  const door = { door: { at: 4, width: 1, height: 2 } }

  it('cuts the near wall by the real eye: the wall between the camera and the player, at each quarter heading', () => {
    // The player in the middle of the room, the camera 4.5 m behind: out past the wall it looks through.
    expect(view(0).walls).toEqual({ cut: ['wall:room/0'], faded: [] }) //     looking south: the north wall
    expect(view(QUARTER).walls).toEqual({ cut: ['wall:room/3'], faded: [] }) // looking east: the west wall
    expect(view(HALF).walls).toEqual({ cut: ['wall:room/2'], faded: [] }) //   looking north: the south wall
    expect(view(3 * QUARTER).walls).toEqual({ cut: ['wall:room/1'], faded: [] }) // looking west: the east wall
  })

  it('cuts nothing when the camera is inside the room', () => {
    // 0.5 m from the south wall, the camera stands 4.5 m north of it: at z = 1, in the room.
    expect(view(0, {}, [4, 0, 5.5]).walls).toEqual({ cut: [], faded: [] })
  })

  it('names a wall once when a door makes it several surfaces', () => {
    const mesh = room({ 0: door })
    expect(mesh.surfaces.filter((surface) => surface.selection === 'wall:room/0').length).toBeGreaterThan(1)
    expect(roomView(mesh, cameraView('view'), MIDDLE, 0).walls).toEqual({ cut: ['wall:room/0'], faded: [] })
  })

  it('fades a wall that says fade where it would cut it, and shows one that says never', () => {
    expect(roomView(room({ 0: { occlude: 'fade' } }), cameraView('view'), MIDDLE, 0).walls).toEqual({
      cut: [],
      faded: ['wall:room/0'],
    })
    expect(roomView(room({ 0: { occlude: 'never' } }), cameraView('view'), MIDDLE, 0).walls).toEqual({
      cut: [],
      faded: [],
    })
  })

  it('looks through the camera followCamera makes, and says whether the player may turn it', () => {
    const spec = cameraView('view', { tiltDeg: 30, distance: 4 })
    const seen = roomView(room(), spec, MIDDLE, 9_000)
    expect(seen.camera).toEqual(followCamera(spec, MIDDLE, 9_000))
    expect(seen.rotate).toBe(true)
    expect(roomView(room(), cameraView('view', { rotate: false }), MIDDLE, 9_000).rotate).toBe(false)
  })

  it('looks along the heading it is given, wrapped into one turn', () => {
    expect(view(5).heading).toBe(5)
    expect(view(TURN_UNITS + 5).heading).toBe(5)
    expect(view(-1).heading).toBe(TURN_UNITS - 1)
  })

  it('enters at the view’s own yawDeg when no heading is given, else at 0', () => {
    expect(view(undefined).heading).toBe(0)
    expect(view(undefined, { yawDeg: 90 }).heading).toBe(QUARTER)
    expect(view(undefined, { yawDeg: -90 }).heading).toBe(3 * QUARTER)
    expect(view(undefined, { yawDeg: 90 }).camera).toEqual(followCamera(cameraView('view'), MIDDLE, QUARTER))
  })

  it('lets the player turn away from the yawDeg when the view allows it, and holds a locked view at it', () => {
    expect(view(HALF, { yawDeg: 90 }).heading).toBe(HALF)
    // A room with `rotate: false` ignores the turn: it looks along its yawDeg whatever heading is asked for.
    expect(view(HALF, { yawDeg: 90, rotate: false }).heading).toBe(QUARTER)
    expect(view(undefined, { yawDeg: 90, rotate: false }).heading).toBe(QUARTER)
    // A locked room with no yawDeg keeps the heading the player came in with.
    expect(view(HALF, { rotate: false }).heading).toBe(HALF)
  })
})
