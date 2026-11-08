import type { Size } from '@mcthaydt/automata-editor/kit/core'
import { parseSelection } from '../model/selection-ref'
import type { GeometryLayer } from '../profile/level-profile'
import type { Camera3D } from '../view/mesh/camera-3d'
import type { WalkAim } from '../view/walk/walk-controller'

// What the Walk view's overlay says (ED3D.8b; ED3D spec §6, §9): the minimap of the level's rooms with the eye on it, and
// the words for what the crosshair is on. Pure, so the view draws what these give and a test reads them.

const MARGIN = 8
/** How far ahead of the eye the minimap's heading mark stands, in pixels. */
const HEADING_MARK = 14

export interface Minimap {
  /** Each room's outline, `x, y` pixels for each corner. */
  readonly rooms: readonly (readonly number[])[]
  /** The eye on the map. */
  readonly eye: { readonly x: number; readonly y: number }
  /** A point ahead of the eye along its heading: north is up the map, as on the plan. */
  readonly heading: { readonly x: number; readonly y: number }
}

/** The level's rooms fitted into `box` with a margin, the eye and its heading on them. */
export function minimapOf(layers: readonly GeometryLayer[], camera: Camera3D, box: Size): Minimap {
  const outlines = layers.flatMap((layer) => [...layer.map.sectors].map((sector) => sector.points[0] ?? []))
  const points = outlines.flat()
  if (points.length === 0) {
    const middle = { x: box.w / 2, y: box.h / 2 }
    return { rooms: [], eye: middle, heading: ahead(middle, camera.yaw) }
  }
  const x0 = Math.min(...points.map((point) => point.x))
  const x1 = Math.max(...points.map((point) => point.x))
  const z0 = Math.min(...points.map((point) => point.z))
  const z1 = Math.max(...points.map((point) => point.z))
  const scale = Math.min(
    (box.w - 2 * MARGIN) / Math.max(x1 - x0, 1e-6),
    (box.h - 2 * MARGIN) / Math.max(z1 - z0, 1e-6),
  )
  const left = (box.w - (x1 - x0) * scale) / 2
  const top = (box.h - (z1 - z0) * scale) / 2
  const at = (x: number, z: number) => ({ x: left + (x - x0) * scale, y: top + (z - z0) * scale })
  const eye = at(camera.eye[0], camera.eye[2])
  return {
    rooms: outlines.map((outline) =>
      outline.flatMap((point) => [at(point.x, point.z).x, at(point.x, point.z).y]),
    ),
    eye,
    heading: ahead(eye, camera.yaw),
  }
}

/** A point `HEADING_MARK` pixels from `from` along a compass bearing (0 is north, up the map). */
const ahead = (from: { x: number; y: number }, yaw: number): { x: number; y: number } => ({
  x: from.x + Math.sin(yaw) * HEADING_MARK,
  y: from.y - Math.cos(yaw) * HEADING_MARK,
})

/** The words for what the crosshair is on, as the selection chip shows them. */
export function aimWords(aim: WalkAim | undefined): string {
  if (aim === undefined) return 'Nothing there'
  const far = `${aim.distance.toFixed(1)} m`
  if (aim.selection === undefined) return `A locked or hidden surface of ${aim.sector} · ${far}`
  const picked = parseSelection(aim.selection)
  if (picked?.kind === 'wall') return `Wall ${picked.corner + 1} of ${picked.sector} · ${far}`
  return `${aim.role === 'ceiling' ? 'Ceiling' : 'Floor'} of ${aim.sector} · ${far}`
}
