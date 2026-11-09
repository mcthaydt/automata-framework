// The dollhouse as a paint list (ED3D.5e, plan decision 1; ED3D spec §6, ED3D-D6): each surface the orbit camera sees,
// as triangles in canvas pixels, flat-shaded by the surface's own shade, drawn far to near by each triangle's farthest
// point (a painter's algorithm: a blockout of tens of rooms needs no depth buffer). A surface that faces away from the eye
// is cut away unless it says `fade` (drawn at a quarter) or `never`; a triangle with a point behind the eye is left out.
// The selection is a sector's id (all its surfaces) or a wall's (that wall).
import type { Size } from '@automata/editor/kit/core'
import { type Camera3D, clipToNear, type Orbit, orbitCamera, projectPoint } from '../view/mesh/camera-3d'
import { surfaceVisibility } from '../view/mesh/mesh-pick'
import type { SectorMesh, Surface, SurfaceRole, Vec3 } from '../view/mesh/sector-mesh'
import { PLAN_COLORS } from '../view/plan/plan-colors'

export interface DollhousePolygon {
  /** `x, y` in canvas pixels for each corner. */
  readonly points: readonly number[]
  /**
   * The edges of the surface's outline this triangle owns, `x1, y1, x2, y2` each in canvas pixels: drawn with the triangle
   * so a nearer surface covers them, and never the diagonal between two triangles of one surface.
   */
  readonly edges: readonly number[]
  readonly color: number
  readonly alpha: number
  readonly role: SurfaceRole
  readonly selection: string | undefined
  readonly selected: boolean
  /** The farthest corner's distance ahead of the eye, in metres: what the polygons are sorted by. */
  readonly depth: number
}

export interface DollhousePaint {
  readonly background: number
  readonly accent: number
  readonly polygons: readonly DollhousePolygon[]
}

/** The blockout's colours by role, at full light (the mockups' `view/3d` greys; a door is the plan's door). */
const ROLE_COLORS: Readonly<Record<SurfaceRole, number>> = {
  floor: 0x5a6070,
  ceiling: 0x3a3f4a,
  wall: 0xb4bac6,
  lower: 0x9aa1ae,
  upper: 0x9aa1ae,
  door: PLAN_COLORS.door,
}
const FADED = 0.25
/** The darkest a surface gets, so an unlit wall still reads against the background. */
const AMBIENT = 0.35

/** `color` with each channel scaled by `light` (0 to 1). */
function lit(color: number, light: number): number {
  const factor = AMBIENT + (1 - AMBIENT) * Math.min(Math.max(light, 0), 1)
  const channel = (shift: number) => Math.round(((color >> shift) & 0xff) * factor)
  return (channel(16) << 16) | (channel(8) << 8) | channel(0)
}

/** The edges of a surface's triangles that only one triangle has: its outline. Keyed by the two indices, low first. */
function outlineEdges(indices: readonly number[]): ReadonlySet<string> {
  const count = new Map<string, number>()
  for (let i = 0; i + 2 < indices.length; i += 3)
    for (const [a, b] of [
      [indices[i], indices[i + 1]],
      [indices[i + 1], indices[i + 2]],
      [indices[i + 2], indices[i]],
    ] as const) {
      const key = edgeKey(a ?? 0, b ?? 0)
      count.set(key, (count.get(key) ?? 0) + 1)
    }
  return new Set([...count].filter(([, times]) => times === 1).map(([key]) => key))
}

const edgeKey = (a: number, b: number): string => (a < b ? `${a}-${b}` : `${b}-${a}`)

const isSelected = (surface: Surface, selected: ReadonlySet<string>): boolean =>
  (surface.selection !== undefined && selected.has(surface.selection)) ||
  selected.has(`sector:${surface.sector}`)

/** The dollhouse: the mesh through the orbit camera. */
export function dollhousePaint(
  mesh: SectorMesh,
  orbit: Orbit,
  size: Size,
  selected: ReadonlySet<string>,
): DollhousePaint {
  return meshPaint(mesh, orbitCamera(orbit), size, selected)
}

/**
 * The mesh through any camera: the dollhouse's orbit and Walk's first-person eye (ED3D.8b) paint the same list, so a
 * surface looks the same in both. A first-person eye is inside a room: the walls around it face it and are drawn, the
 * ones behind it have points behind the eye and are left out.
 */
export function meshPaint(
  mesh: SectorMesh,
  camera: Camera3D,
  size: Size,
  selected: ReadonlySet<string>,
): DollhousePaint {
  const polygons: DollhousePolygon[] = []
  for (const surface of mesh.surfaces) {
    const visibility = surfaceVisibility(surface, camera.eye)
    if (visibility === 'cut') continue
    const outline = outlineEdges(surface.indices)
    for (let i = 0; i + 2 < surface.indices.length; i += 3) {
      const indices = [
        surface.indices[i] ?? 0,
        surface.indices[i + 1] ?? 0,
        surface.indices[i + 2] ?? 0,
      ] as const
      const corners = indices.map((index) => {
        const at = index * 3
        return [
          surface.positions[at] ?? 0,
          surface.positions[at + 1] ?? 0,
          surface.positions[at + 2] ?? 0,
        ] as Vec3
      }) as [Vec3, Vec3, Vec3]
      const clipped = clipToNear(camera, corners)
      if (clipped === undefined) continue
      const projected = clipped.points.map((point) => projectPoint(camera, size, point))
      if (projected.some((point) => point === undefined)) continue
      const points = projected as { x: number; y: number; depth: number }[]
      // The polygon is a fan of triangles from its first corner; each outline segment goes with the triangle it is on.
      const last = points.length - 2
      for (let j = 1; j <= last; j++) {
        const edges: number[] = []
        const owns = (segment: number): boolean =>
          segment === j || (j === 1 && segment === 0) || (j === last && segment === points.length - 1)
        for (let segment = 0; segment < points.length; segment++) {
          const own = clipped.edge[segment] ?? -1
          if (own < 0 || !owns(segment)) continue
          const [from, to] = [own, (own + 1) % 3] as const
          if (!outline.has(edgeKey(indices[from] as number, indices[to] as number))) continue
          const [a, b] = [points[segment], points[(segment + 1) % points.length]] as [
            { x: number; y: number },
            { x: number; y: number },
          ]
          edges.push(a.x, a.y, b.x, b.y)
        }
        const triangle = [points[0], points[j], points[j + 1]] as { x: number; y: number; depth: number }[]
        polygons.push({
          points: triangle.flatMap((point) => [point.x, point.y]),
          edges,
          color: lit(ROLE_COLORS[surface.role], surface.shade),
          alpha: visibility === 'faded' ? FADED : 1,
          role: surface.role,
          selection: surface.selection,
          selected: isSelected(surface, selected),
          depth: Math.max(...triangle.map((point) => point.depth)),
        })
      }
    }
  }
  // Far to near; of two at the same depth, the mesh's order.
  const ordered = polygons.map((polygon, index) => ({ polygon, index }))
  ordered.sort((a, b) => b.polygon.depth - a.polygon.depth || a.index - b.index)
  return {
    background: PLAN_COLORS.background,
    accent: PLAN_COLORS.accent,
    polygons: ordered.map((each) => each.polygon),
  }
}
