// What the active plan tool paints over the plan (ED3D.6g-a, plan decision 2; ED3D spec §5.3 flow 2, §9 `Draw a
// sector`): the drawing's edges (the pending one dashed) with their lengths, its corners, the snap ring and a ring on the
// first corner while a tap would close; a Wall, Vertex or Split target as a ring at its point, in the refusal colour with
// the tool's sentence when a tap there would be refused; the Split cut; the rooms Merge would join. In canvas pixels from
// the plan's own viewport, so the overlay can never drift from the walls under it. Labels are drawn by the DOM.
import type { Point as ScreenPoint, Size, Viewport2D } from '@automata/editor/kit/core'
import type { Point } from '../format/sector.schema'
import type { ViewState } from '../model/view-store'
import { PLAN_COLORS } from '../view/plan/plan-colors'
import type { PaintFill, PaintStroke } from '../view/plan/plan-paint'
import { planViewport, toScreen } from '../view/plan/plan-viewport'
import type { PlanToolState } from './plan-tools'

export interface ToolDot {
  readonly at: ScreenPoint
  readonly radius: number
  readonly color: number
  /** A ring rather than a filled disc. */
  readonly ring: boolean
}

export interface ToolOutline {
  /** A sector's outline in canvas pixels, as `PaintFill.points`. */
  readonly points: readonly number[]
  readonly color: number
}

export interface ToolLabel {
  readonly at: ScreenPoint
  readonly text: string
  /** A length along an edge, or the sentence a tap there would be refused with. */
  readonly tone: 'length' | 'refused'
}

export interface ToolPaint {
  readonly strokes: readonly PaintStroke[]
  readonly dots: readonly ToolDot[]
  readonly outlines: readonly ToolOutline[]
  readonly labels: readonly ToolLabel[]
}

const CORNER = 4
const TARGET = 7
const CLOSING = 11
const WIDTH = 2

const NO_TOOL_PAINT: ToolPaint = { strokes: [], dots: [], outlines: [], labels: [] }

const metres = (length: number): string => `${length.toFixed(2)} m`

/** The overlay of `state` over a plan of `fills`, shown through `viewport`. */
export function toolPaint(
  state: PlanToolState,
  viewport: Viewport2D,
  fills: readonly PaintFill[],
): ToolPaint {
  const screen = (point: Point): ScreenPoint => toScreen(viewport, point)
  const middle = (a: Point, b: Point): ScreenPoint => screen({ x: (a.x + b.x) / 2, z: (a.z + b.z) / 2 })
  const edge = (a: Point, b: Point, dashed: boolean): PaintStroke => ({
    a: screen(a),
    b: screen(b),
    color: PLAN_COLORS.accent,
    width: WIDTH,
    dashed,
  })
  const corner = (point: Point): ToolDot => ({
    at: screen(point),
    radius: CORNER,
    color: PLAN_COLORS.accent,
    ring: false,
  })
  /** A target's ring, and its sentence when a tap there would be refused. */
  const target = (point: Point, reason: string | undefined): ToolPaint => ({
    ...NO_TOOL_PAINT,
    dots: [
      {
        at: screen(point),
        radius: TARGET,
        color: reason === undefined ? PLAN_COLORS.accent : PLAN_COLORS.refused,
        ring: true,
      },
    ],
    labels: reason === undefined ? [] : [{ at: screen(point), text: reason, tone: 'refused' }],
  })
  const reasonOf = (effect: { readonly action: string; readonly reason?: string }): string | undefined =>
    effect.action === 'none' ? effect.reason : undefined

  switch (state.tool) {
    case 'select':
      return NO_TOOL_PAINT
    case 'polygon':
    case 'rectangle': {
      const { view } = state
      const dots: ToolDot[] = view.corners.map(corner)
      if (view.snap !== undefined)
        dots.push({ at: screen(view.snap), radius: TARGET, color: PLAN_COLORS.snap, ring: true })
      const first = view.corners[0]
      if (view.closing && first !== undefined)
        dots.push({ at: screen(first), radius: CLOSING, color: PLAN_COLORS.accent, ring: true })
      return {
        strokes: view.edges.map((each) => edge(each.a, each.b, each.pending)),
        dots,
        outlines: [],
        labels: view.edges.map((each) => ({
          at: middle(each.a, each.b),
          text: metres(each.length),
          tone: 'length',
        })),
      }
    }
    case 'vertex':
    case 'portal':
    case 'door':
    case 'window': {
      const found = state.view.target
      return found === undefined ? NO_TOOL_PAINT : target(found.point, reasonOf(found))
    }
    case 'split': {
      const { view } = state
      const marked =
        view.target === undefined ? NO_TOOL_PAINT : target(view.target.point, reasonOf(view.target))
      return {
        strokes: view.cut === undefined ? [] : [edge(view.cut.a, view.cut.b, true)],
        dots: [...(view.start === undefined ? [] : [corner(view.start.point)]), ...marked.dots],
        outlines: [],
        labels: [
          ...(view.cut === undefined
            ? []
            : [
                {
                  at: middle(view.cut.a, view.cut.b),
                  text: metres(view.cut.length),
                  tone: 'length' as const,
                },
              ]),
          ...marked.labels,
        ],
      }
    }
    case 'things': {
      const place = state.view.place
      if (place === undefined) return NO_TOOL_PAINT
      const marked = target(place, reasonOf(place))
      const area = place.area
      if (area === undefined) return marked
      const corners: Point[] = [
        { x: area.x0, z: area.z0 },
        { x: area.x1, z: area.z0 },
        { x: area.x1, z: area.z1 },
        { x: area.x0, z: area.z1 },
      ]
      return {
        ...marked,
        strokes: corners.map((corner, index) =>
          edge(corner, corners[(index + 1) % corners.length] as Point, true),
        ),
      }
    }
    case 'merge': {
      const { view } = state
      const outline = (sector: string, color: number): ToolOutline[] =>
        fills.filter((fill) => fill.sector === sector).map((fill) => ({ points: fill.points, color }))
      const found = view.target
      return {
        ...NO_TOOL_PAINT,
        outlines: [
          ...(view.keep === undefined ? [] : outline(view.keep, PLAN_COLORS.accent)),
          ...(found === undefined || found.sector === view.keep
            ? []
            : outline(found.sector, found.action === 'none' ? PLAN_COLORS.refused : PLAN_COLORS.snap)),
        ],
      }
    }
  }
}

/** The overlay for the view's camera on a canvas of `size`: what the Plan canvas draws over `planPaint`'s list. */
export const toolOverlay = (
  state: PlanToolState,
  camera: ViewState['camera'],
  size: Size,
  fills: readonly PaintFill[],
): ToolPaint => toolPaint(state, planViewport(camera, size), fills)
