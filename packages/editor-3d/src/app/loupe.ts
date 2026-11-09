// The loupe the Plan canvas hands its renderer (ED3D.6g-b, plan decision 1): while the Sector tool has a loupe point
// (the snapped point under a Pencil, or the last corner after a nudge), the plan and the tool's overlay for a camera
// centred on that point at four times the zoom, in a lens placed clear of the point and the canvas edge.
import type { Size } from '@automataframework/automata-editor/kit/core'
import type { LevelEditor } from '../model/level-editor'
import type { PlanPaint } from '../view/plan/plan-paint'
import { planViewport, toScreen } from '../view/plan/plan-viewport'
import { LENS, loupePlace, nudgePlace } from './loupe-place'
import { loupeCamera } from './plan-picture'
import type { PlanToolState, PlanTools } from './plan-tools'
import { type ToolPaint, toolPaint } from './tool-paint'

export interface Loupe {
  readonly paint: PlanPaint
  readonly tool: ToolPaint | undefined
  /** The lens's top-left on the canvas, and its diameter. */
  readonly x: number
  readonly y: number
  readonly size: number
}

export function loupeOf<D>(
  editor: LevelEditor<D>,
  state: PlanToolState,
  size: Size,
  picture: (size: Size, camera?: LevelEditor<D>['view']['state']['camera']) => PlanPaint,
): Loupe | undefined {
  if (state.tool !== 'polygon' && state.tool !== 'rectangle') return undefined
  const point = state.view.loupe
  if (point === undefined) return undefined
  const { camera } = editor.view.state
  const lensSize = { w: LENS, h: LENS }
  const lensCamera = loupeCamera(camera, point)
  const paint = picture(lensSize, lensCamera)
  const place = loupePlace(toScreen(planViewport(camera, size), point), size)
  return {
    paint,
    tool: toolPaint(state, planViewport(lensCamera, lensSize), paint.fills),
    x: place.x,
    y: place.y,
    size: LENS,
  }
}

/**
 * Where the nudge pad goes while the Sector tool has corners placed with touch or a Pencil (spec §9: never for a mouse),
 * clear of the last corner; nothing otherwise, and nothing while portal offers are open.
 */
export function nudgePadOf<D>(
  editor: LevelEditor<D>,
  tools: PlanTools,
  size: Size,
): 'left' | 'right' | undefined {
  const view = tools.sector?.view
  const last = view?.corners.at(-1)
  if (view === undefined || last === undefined || view.offers.length > 0) return undefined
  if (tools.pointerKind !== 'touch' && tools.pointerKind !== 'pen') return undefined
  return nudgePlace(toScreen(planViewport(editor.view.state.camera, size), last), size)
}
