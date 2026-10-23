// The Plan view's Select tool as plain TypeScript (ED3D.5a, ED3D spec §5.3 flows 2 and 3 and §10): what a pointer does to
// the selection, the level and the camera on the plan. No Svelte, DOM, Pixi or clock in here: the view forwards what the
// kit's gesture recogniser says (canvas pixels, the pointer kind and the modifier keys), reads `view` and paints what it
// says. The level stays in the editor's history, the selection in its selection and the camera in its view store, so the
// controller keeps only what a pointer is in the middle of; undo, redo and a change of layers need nothing from the view.
import type { PointerKind, Size, Viewport2D } from '@mcthaydt/automata-editor-kit/core'
import type { LevelEditor } from '../model/level-editor'
import { parseSelection } from '../model/selection-ref'
import { GeometryError, type GeometryLayer } from '../profile/level-profile'
import {
  type CornerHit,
  PICK_RADIUS,
  type PickOptions,
  type PlanHit,
  pickCorner,
  pickPlan,
} from '../view/plan/plan-pick'
import type { SnapResult } from '../view/plan/plan-snap'
import { planViewport } from '../view/plan/plan-viewport'
import { type SelectionOf, selectionOf } from '../view/selection-of'

/** A pointer on the canvas, in pixels from its top left. */
export interface PlanPointer {
  readonly x: number
  readonly y: number
  readonly kind: PointerKind
  /** The fine snap step. */
  readonly shift?: boolean | undefined
  /** No snap. */
  readonly alt?: boolean | undefined
  /** Ctrl or Meta: a tap adds to the selection, or takes off what is already in it. */
  readonly additive?: boolean | undefined
}

export interface PlanView {
  /** What the pointer is over: a wall, else a sector. */
  readonly hover: PlanHit | undefined
  /** The handle of a corner of a selected sector under the pointer. */
  readonly corner: CornerHit | undefined
  /** Where a dragged corner is, and what it snapped to. */
  readonly snap: SnapResult | undefined
  readonly gesture: 'idle' | 'corner' | 'sector' | 'pan'
  /** The sentence a refused run of the drag gave, until the next run is accepted or the drag ends. */
  readonly refusal: string | undefined
}

export interface PlanController {
  readonly view: PlanView
  /** Called after `view` changes; returns a way to stop. */
  subscribe(run: () => void): () => void
  hover(at: PlanPointer): void
  /** The pointer left the canvas. */
  leave(): void
  /** Selects what the pointer touches: a wall, else a sector; with `additive` it adds or takes off, and nothing leaves it. */
  tap(at: PlanPointer): void
  /** Stops following the editor. */
  dispose(): void
}

const IDLE: PlanView = {
  hover: undefined,
  corner: undefined,
  snap: undefined,
  gesture: 'idle',
  refusal: undefined,
}

/** Equal as data: a pick is a few numbers and a few names. */
const same = (a: unknown, b: unknown): boolean => JSON.stringify(a) === JSON.stringify(b)

interface Geometry<D> {
  readonly level: D
  readonly layers: readonly GeometryLayer[]
  readonly select: SelectionOf
}

export function createPlanController<D>(editor: LevelEditor<D>, size: Size): PlanController {
  const listeners = new Set<() => void>()
  let view: PlanView = IDLE
  let pointer: PlanPointer | undefined

  /**
   * The geometry and the selection ids of the level last seen, by identity: a hover costs picks and not a rebuild. A level
   * that cannot be resolved has no layers, so nothing is hit and the view goes on working.
   */
  let cache: Geometry<D> | undefined
  const geometry = (): Geometry<D> => {
    const level = editor.level
    if (cache?.level === level) return cache
    let layers: readonly GeometryLayer[] = []
    try {
      layers = editor.profile.geometry(level).layers
    } catch (error) {
      if (!(error instanceof GeometryError)) throw error
    }
    cache = { level, layers, select: selectionOf(editor.profile, level) }
    return cache
  }

  const setView = (next: PlanView): void => {
    if (same(view, next)) return
    view = next
    for (const run of [...listeners]) run()
  }

  /** The sectors the selection names: a selected sector, and the sector a selected wall is of. */
  const selectedSectors = (): ReadonlySet<string> =>
    new Set(
      editor.selection.ids.flatMap((id) => {
        const ref = parseSelection(id)
        return ref?.kind === 'sector' || ref?.kind === 'wall' ? [ref.sector] : []
      }),
    )

  const currentViewport = (): Viewport2D => planViewport(editor.view.state.camera, size)

  /** The reach of the pointer kind, and the layers that are not hit. */
  const pickOptions = (at: PlanPointer): PickOptions => {
    const { hidden, locked } = editor.view.state
    return { radius: PICK_RADIUS[at.kind], hidden, locked }
  }

  /** What the pointer is over now, from the level, the selection, the layers and the camera as they are. */
  const refresh = (): void => {
    if (pointer === undefined) {
      setView({ ...view, hover: undefined, corner: undefined })
      return
    }
    const { layers, select } = geometry()
    const viewport = currentViewport()
    const options = pickOptions(pointer)
    // Only the corners of a selected sector have handles: `pickCorner` reads them from `corners`.
    const selected = selectedSectors()
    const handles: SelectionOf = { ...select, corners: (id) => (selected.has(id) ? select.corners(id) : []) }
    setView({
      ...view,
      hover: pickPlan(layers, select, viewport, pointer, options),
      corner: pickCorner(layers, handles, viewport, pointer, options),
    })
  }

  const stops = [
    editor.history.subscribe(refresh),
    editor.selection.subscribe(refresh),
    editor.view.subscribe(refresh),
  ]

  return {
    get view() {
      return view
    },
    subscribe(run) {
      listeners.add(run)
      return () => {
        listeners.delete(run)
      }
    },
    hover(at) {
      pointer = at
      refresh()
    },
    leave() {
      pointer = undefined
      refresh()
    },
    tap(at) {
      pointer = at
      const { layers, select } = geometry()
      const hit = pickPlan(layers, select, currentViewport(), at, pickOptions(at))
      if (hit === undefined) {
        if (at.additive !== true) editor.selection.clear()
      } else if (at.additive === true) editor.selection.toggle(hit.selection)
      else editor.selection.set([hit.selection])
      // The handles and the hover of the new selection are under the pointer already.
      refresh()
    },
    dispose() {
      for (const stop of stops) stop()
      listeners.clear()
    },
  }
}
