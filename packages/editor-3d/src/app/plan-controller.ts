// The Plan view's Select tool as plain TypeScript (ED3D.5a, ED3D spec §5.3 flows 2 and 3 and §10): what a pointer does to
// the selection, the level and the camera on the plan. No Svelte, DOM, Pixi or clock in here: the view forwards what the
// kit's gesture recogniser says (canvas pixels, the pointer kind and the modifier keys), reads `view` and paints what it
// says. The level stays in the editor's history, the selection in its selection and the camera in its view store, so the
// controller keeps only what a pointer is in the middle of; undo, redo and a change of layers need nothing from the view.
import type { PointerKind, Size, Viewport2D } from '@mcthaydt/automata-editor-kit/core'
import { sectorSelection } from '../checks/check'
import type { Point } from '../format/sector.schema'
import { moveCorner, moveSector } from '../model/corner-edits'
import type { EditSession, LevelEditor } from '../model/level-editor'
import { parseSelection } from '../model/selection-ref'
import { GeometryError, type GeometryLayer } from '../profile/level-profile'
import {
  type CornerHit,
  isLayerOff,
  PICK_RADIUS,
  type PickOptions,
  type PlanHit,
  pickCorner,
  pickPlan,
} from '../view/plan/plan-pick'
import { type SnapResult, snapPlan, stepOf } from '../view/plan/plan-snap'
import { planViewport, snapValue, toWorld } from '../view/plan/plan-viewport'
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
  /** A press that has moved past the slop. What it grabs is what is under `press`; `at` is where the drag has got to. */
  dragStart(press: PlanPointer, at: PlanPointer): void
  drag(at: PlanPointer): void
  /** `cancelled` is a cancelled pointer: nothing is kept. */
  dragEnd(at: PlanPointer, cancelled: boolean): void
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

/** What a drag is in the middle of. The session shows its runs live and is one undo step when it commits. */
interface Drag<D> {
  readonly session: EditSession<D>
  /** The level as the drag found it: the snap targets, and what the drag is compared with when it ends. */
  readonly base: Geometry<D>
  readonly sector: string
}

interface CornerDrag<D> extends Drag<D> {
  readonly kind: 'corner'
  readonly corner: number
}

interface SectorDrag<D> extends Drag<D> {
  readonly kind: 'sector'
  /** Where the press was, in metres: the offset is the pointer's distance from it. */
  readonly press: Point
  /** The offset the sector has been moved by so far. A run is the step from it to the pointer's offset. */
  applied: Point
}

export function createPlanController<D>(editor: LevelEditor<D>, size: Size): PlanController {
  const listeners = new Set<() => void>()
  let view: PlanView = IDLE
  let pointer: PlanPointer | undefined
  let gesture: CornerDrag<D> | SectorDrag<D> | undefined

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

  /** The corner handles that can be grabbed: those of the selected sectors, which `pickCorner` reads from `corners`. */
  const handlesOf = (select: SelectionOf): SelectionOf => {
    const selected = selectedSectors()
    return { ...select, corners: (id) => (selected.has(id) ? select.corners(id) : []) }
  }

  const endDrag = (): void => {
    gesture = undefined
    setView({ ...view, gesture: 'idle', snap: undefined, refusal: undefined })
  }

  /** What the pointer is over now, from the level, the selection, the layers and the camera as they are. */
  const refresh = (): void => {
    // An undo has closed the drag's session: nothing of it is left to follow.
    if (gesture?.session.open === false) endDrag()
    if (pointer === undefined) {
      setView({ ...view, hover: undefined, corner: undefined })
      return
    }
    const { layers, select } = geometry()
    const viewport = currentViewport()
    const options = pickOptions(pointer)
    setView({
      ...view,
      hover: pickPlan(layers, select, viewport, pointer, options),
      corner: pickCorner(layers, handlesOf(select), viewport, pointer, options),
    })
  }

  /** Runs the corner at the snapped point of the pointer. A refusal keeps what the last accepted run made. */
  const moveGrabbedCorner = (grabbed: CornerDrag<D>, at: PlanPointer): void => {
    const snap = snapPlan(grabbed.base.layers, grabbed.base.select, currentViewport(), at, {
      ...pickOptions(at),
      grid: editor.view.state.grid,
      shiftKey: at.shift,
      altKey: at.alt,
    })
    const result = grabbed.session.run(
      moveCorner({ sector: grabbed.sector, corner: grabbed.corner, x: snap.x, z: snap.z }),
    )
    setView({ ...view, snap, refusal: result.ok ? undefined : result.reason })
  }

  /**
   * Moves the sector by the pointer's offset from the press, rounded to the grid (the fine step with Shift, none with Alt).
   * A refusal keeps what the last accepted run made, and the next run goes on from that offset.
   */
  const moveGrabbedSector = (grabbed: SectorDrag<D>, at: PlanPointer): void => {
    const world = toWorld(currentViewport(), at)
    const { step } = stepOf({ grid: editor.view.state.grid, shiftKey: at.shift })
    const fine = at.alt === true ? 0 : step
    const target = {
      x: snapValue(world.x - grabbed.press.x, fine),
      z: snapValue(world.z - grabbed.press.z, fine),
    }
    const result = grabbed.session.run(
      moveSector({
        id: grabbed.sector,
        dx: target.x - grabbed.applied.x,
        dz: target.z - grabbed.applied.z,
      }),
    )
    if (result.ok) grabbed.applied = target
    setView({ ...view, refusal: result.ok ? undefined : result.reason })
  }

  const moveGrabbed = (grabbed: CornerDrag<D> | SectorDrag<D>, at: PlanPointer): void =>
    grabbed.kind === 'corner' ? moveGrabbedCorner(grabbed, at) : moveGrabbedSector(grabbed, at)

  /**
   * Ends the drag: its step is kept unless it was cancelled, or ended with the level as it began. The drag is over before
   * the history hears of the commit or the cancel, so what that tells `refresh` is only about the level.
   */
  const finish = (grabbed: Drag<D>, keep: boolean): void => {
    endDrag()
    // A session that is already closed (an undo ended it) ignores both.
    if (keep && !same(editor.level, grabbed.base.level)) grabbed.session.commit()
    else grabbed.session.cancel()
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
    dragStart(press, at) {
      if (gesture !== undefined) finish(gesture, false)
      const { layers, select } = geometry()
      const handle = pickCorner(layers, handlesOf(select), currentViewport(), press, pickOptions(press))
      if (handle !== undefined) {
        const session = editor.begin(`Move corner ${handle.corner} of ${handle.sector}`)
        if (!session.open) return
        gesture = {
          kind: 'corner',
          session,
          base: geometry(),
          sector: handle.sector,
          corner: handle.corner,
        }
        setView({ ...view, gesture: 'corner' })
      } else {
        const options = pickOptions(press)
        const hit = pickPlan(layers, select, currentViewport(), press, options)
        // A finger moves only a sector that is selected: on any other it pans, as on a page.
        const grabbable =
          hit !== undefined &&
          !isLayerOff(options, 'sectors') &&
          (press.kind !== 'touch' || selectedSectors().has(hit.sector))
        if (grabbable) {
          const session = editor.begin(`Move sector ${hit.sector}`)
          if (!session.open) return
          if (!selectedSectors().has(hit.sector)) editor.selection.set([sectorSelection(hit.sector)])
          gesture = {
            kind: 'sector',
            session,
            base: geometry(),
            sector: hit.sector,
            press: toWorld(currentViewport(), press),
            applied: { x: 0, z: 0 },
          }
          setView({ ...view, gesture: 'sector' })
        }
      }
      this.drag(at)
    },
    drag(at) {
      pointer = at
      if (gesture?.session.open) moveGrabbed(gesture, at)
      else refresh()
    },
    dragEnd(at, cancelled) {
      pointer = at
      if (gesture === undefined) {
        refresh()
        return
      }
      if (!cancelled && gesture.session.open) moveGrabbed(gesture, at)
      // The run may have ended the drag itself (an undo); a drag that is gone has nothing to keep.
      if (gesture !== undefined) finish(gesture, !cancelled)
    },
    dispose() {
      for (const stop of stops) stop()
      listeners.clear()
    },
  }
}
