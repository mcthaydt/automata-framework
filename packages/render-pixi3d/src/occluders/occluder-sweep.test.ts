// D3-h on fixture rooms (`games/base-3d`'s rooms are M3.7b): for each view, at every 15° of heading, with the player
// 0.3 m in from each corner of the room and at its centre, the camera placed by M3.4b's `framedFocus` and `eyeOf`,
// a ray from the eye to the player's head and to its feet hits no wall, trim or prop drawn opaque after the occluder
// rule; in one room the cut walls are exactly those whose inside face points away from the eye; a `fade` prop on the
// line is at 25%. The floor is `never` and a ray to the feet ends on it, so it is not tested.
import { describe, expect, it } from 'vitest'
import { eyeOf, framedFocus, type Vec3 } from '../camera/camera-pose.js'
import { type CameraView, cameraView } from '../sim/camera-view.schema.js'
import { type OccluderShown, occluderPass, type WallEntry } from './occluder-pass.js'
import { segmentHitsBox, type WallSpan, wallFacesAway } from './occluder-rule.js'
import {
  ONE_ROOM,
  PILLAR,
  type Room,
  segmentHitsWall,
  standingPoints,
  TRIM_HEIGHT,
  TWO_ROOMS,
} from './testing/rooms.js'

const VIEWS: CameraView[] = [
  cameraView('default'),
  cameraView('high', { tiltDeg: 40, distance: 8 }),
  cameraView('low', { tiltDeg: 15, distance: 3 }),
]
const HEADINGS = Array.from({ length: 24 }, (_, i) => i * 15)
const HEIGHT = 1.62

interface Pose {
  readonly eye: Vec3
  readonly feet: Vec3
  readonly head: Vec3
  readonly shown: OccluderShown
}

/** The rule settled (reduced motion) for a fresh pass at one pose. */
function settle(
  walls: readonly WallSpan[],
  props: boolean,
  view: CameraView,
  heading: number,
  feet: Vec3,
): Pose {
  const look = framedFocus({ player: feet, lock: undefined, view, headingDeg: heading, aspect: 16 / 9 })
  const eye = eyeOf(look, heading, view.tiltDeg, view.distance)
  const head = { ...feet, y: feet.y + HEIGHT }
  const entries: WallEntry[] = walls.map((span) => ({ span, occlude: 'cut' }))
  const pass = occluderPass({ walls: entries, props: props ? [{ bounds: PILLAR, occlude: 'fade' }] : [] })
  const shown = pass.step({ eye, look, feet, head, seconds: 0, reduced: true })
  return { eye, feet, head, shown }
}

/** What a ray from the eye to `target` hits among the meshes drawn opaque. */
function blockers(walls: readonly WallSpan[], pose: Pose, target: Vec3): string[] {
  const hits: string[] = []
  walls.forEach((span, i) => {
    const shown = pose.shown.walls[i]
    if (shown?.opacity === 1 && segmentHitsWall(span, pose.eye, target, span.height)) hits.push(`wall ${i}`)
    if (shown?.trim === true && segmentHitsWall(span, pose.eye, target, TRIM_HEIGHT)) hits.push(`trim ${i}`)
  })
  const pillar = pose.shown.props[0]
  if (pillar === 1 && segmentHitsBox(pose.eye, target, PILLAR)) hits.push('pillar')
  return hits
}

function sweep(
  rooms: readonly Room[],
  walls: readonly WallSpan[],
  props: boolean,
  check: (pose: Pose) => void,
) {
  for (const view of VIEWS)
    for (const heading of HEADINGS)
      for (const room of rooms)
        for (const feet of standingPoints(room)) check(settle(walls, props, view, heading, feet))
}

describe('D3-h', () => {
  it('one room: no ray to the head or the feet is blocked, and the cut walls are exactly those facing away', () => {
    const failures: string[] = []
    let pillarOnTheLine = 0
    sweep([ONE_ROOM], ONE_ROOM.walls, true, (pose) => {
      for (const target of [pose.head, pose.feet]) {
        const hits = blockers(ONE_ROOM.walls, pose, target)
        if (hits.length > 0) failures.push(`${JSON.stringify(pose.feet)} → ${hits.join(', ')}`)
      }
      const cut = pose.shown.walls.map((w) => w.occluded)
      expect(cut).toEqual(ONE_ROOM.walls.map((span) => wallFacesAway(span, pose.eye)))
      const onLine =
        segmentHitsBox(pose.eye, pose.head, PILLAR) || segmentHitsBox(pose.eye, pose.feet, PILLAR)
      if (onLine) pillarOnTheLine += 1
      expect(pose.shown.props[0]).toBe(onLine ? 0.25 : 1)
    })
    expect(failures).toEqual([])
    // The sweep did put the pillar on the line, so the 25% case was exercised.
    expect(pillarOnTheLine).toBeGreaterThan(0)
  })

  it('two rooms through a doorway: no ray to the head or the feet is blocked, the player in either room', () => {
    const failures: string[] = []
    sweep([TWO_ROOMS.a, TWO_ROOMS.b], TWO_ROOMS.walls, false, (pose) => {
      for (const target of [pose.head, pose.feet]) {
        const hits = blockers(TWO_ROOMS.walls, pose, target)
        if (hits.length > 0) failures.push(`${JSON.stringify(pose.feet)} → ${hits.join(', ')}`)
      }
    })
    expect(failures).toEqual([])
  })
})
