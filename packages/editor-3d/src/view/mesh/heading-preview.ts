// The eight headings of the angled camera (ED3D.4b step 4, the 3D direction spec §4.2): the game turns its camera in eighths
// of a turn, so the designer sees the dollhouse from each of the eight, and what a heading takes away or fades. The editor
// has no player, so "cut" and "faded" are what `surfaceVisibility` says of each wall from that heading's eye.
import type { Size } from '@mcthaydt/automata-editor-kit/core'
import { type Camera3D, fitOrbit, HOME_YAW, type Orbit, orbitCamera } from './camera-3d'
import { surfaceVisibility } from './mesh-pick'
import type { SectorMesh } from './sector-mesh'

/** How many headings the camera has: a turn in steps of an eighth. */
export const HEADINGS = 8
const STEP = (2 * Math.PI) / HEADINGS

export interface HeadingView {
  /** 0 is the first heading, the home one unless a yaw was given; each next is an eighth of a turn clockwise. */
  readonly heading: number
  /** The orbit that frames the whole level from this heading. */
  readonly orbit: Orbit
  readonly camera: Camera3D
  /** How many walls this heading takes away, a wall that is several surfaces (a door in it) counted once. */
  readonly wallsCut: number
  /** How many walls this heading draws faintly: the ones that say `fade` where they would be cut. */
  readonly wallsFaded: number
}

export interface HeadingOptions {
  /** The compass bearing of heading 0; the dollhouse's home bearing when not given. */
  readonly yaw?: number | undefined
  readonly pitch?: number | undefined
  /** The margin kept from the edge of the canvas, in pixels. */
  readonly padding?: number | undefined
}

/** The eight views of a level: framed on its box from each heading, with what each does to the walls. */
export function headingPreview(mesh: SectorMesh, size: Size, options: HeadingOptions = {}): HeadingView[] {
  const first = options.yaw ?? HOME_YAW
  return Array.from({ length: HEADINGS }, (_, heading) => {
    const yaw = (first + heading * STEP) % (2 * Math.PI)
    const orbit = fitOrbit(mesh.bounds, size, { yaw, pitch: options.pitch, padding: options.padding })
    const camera = orbitCamera(orbit)
    const [cut, faded] = [new Set<string>(), new Set<string>()]
    for (const [index, surface] of mesh.surfaces.entries()) {
      if (surface.role === 'floor' || surface.role === 'ceiling') continue
      const seen = surfaceVisibility(surface, camera.eye)
      if (seen === 'shown') continue
      // A wall with no selection (a connector sector's) is one surface of its own.
      const walls = seen === 'cut' ? cut : faded
      walls.add(surface.selection ?? `surface#${index}`)
    }
    return { heading, orbit, camera, wallsCut: cut.size, wallsFaded: faded.size }
  })
}
