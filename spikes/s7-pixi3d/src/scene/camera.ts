// The angled camera's numbers (M3 spec §4.2): a 24 mm lens, 25° down, 5 m back from a focus 1.0 m above the
// followed position. `fovOf` is The Last Light's convention (a 24 mm tall film gate), so 24 mm is 53.13° vertical.

export interface AngledView {
  readonly lensMm: number
  readonly tiltDeg: number
  readonly distance: number
  readonly focusHeight: number
  /** The heading: 0 looks toward +z. */
  readonly yawDeg: number
}

export const DEFAULT_VIEW: AngledView = { lensMm: 24, tiltDeg: 25, distance: 5, focusHeight: 1, yawDeg: 0 }

const DEG = Math.PI / 180

/** The vertical field of view in degrees for a lens on a 24 mm tall gate: 2 · atan(12 / mm). */
export const fovOf = (lensMm: number): number => (2 * Math.atan(12 / lensMm)) / DEG

export interface CameraPose {
  readonly position: { x: number; y: number; z: number }
  readonly focus: { x: number; y: number; z: number }
}

/** Where the camera sits for a followed position: back along the heading and up by the tilt. */
export function cameraPose(followed: { x: number; y: number; z: number }, view: AngledView): CameraPose {
  const focus = { x: followed.x, y: followed.y + view.focusHeight, z: followed.z }
  const tilt = view.tiltDeg * DEG
  const yaw = view.yawDeg * DEG
  const back = view.distance * Math.cos(tilt)
  return {
    focus,
    position: {
      x: focus.x - Math.sin(yaw) * back,
      y: focus.y + view.distance * Math.sin(tilt),
      z: focus.z - Math.cos(yaw) * back,
    },
  }
}
