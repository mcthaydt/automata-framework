// The Plan view's Vertex tool as plain TypeScript (ED3D.6d, ED3D spec §5.3 flow 3, §5.4 and §6): a tap on a wall puts a
// corner there, a tap on a corner takes it away. No Svelte, DOM, Pixi or clock in here: the view forwards what the kit's
// gesture recogniser says (canvas pixels, the pointer kind and the modifier keys, as for the other tools), reads `view`
// and paints the corner ring or the cut mark and what a tap would do. The level, the selection and the camera stay in
// the editor.
//
// The target is a dry run of the edit: `view.target` says what a tap would do by running `insertCorner` or
// `removeCorner` against the live level and not committing it, so the tool cannot disagree with the model about what
// is allowed, and a refusal is the model's own sentence.
import type { Size, Viewport2D } from '@mcthaydt/automata-editor-kit/core'
import type { Point } from '../format/sector.schema'
import type { Edit } from '../model/edit'
import type { LevelEditor } from '../model/level-editor'
import { parseSelection } from '../model/selection-ref'
import { insertCorner, removeCorner } from '../model/vertex-edits'
import { cornerAt, wallLength } from '../model/wall-geometry'
import { isLayerOff, PICK_RADIUS, pickCorner, wallNear } from '../view/plan/plan-pick'
import { planViewport, snapStep, snapValue } from '../view/plan/plan-viewport'
import { createGeometryCache } from './geometry-cache'
import type { PlanPointer } from './plan-controller'

/** What a tap there would do. */
export type VertexEffect =
  | { readonly action: 'add' | 'remove' }
  /** Nothing: the sentence a tap would be refused with. */
  | { readonly action: 'none'; readonly reason: string }

export type VertexTarget =
  /** A corner within reach of the pointer: a tap takes it away. */
  | ({
      readonly kind: 'corner'
      readonly sector: string
      /** The corner in the sector's outline as the document writes it. */
      readonly corner: number
      readonly point: Point
    } & VertexEffect)
  /** A wall within reach and no corner: a tap puts a corner at `point`. */
  | ({
      readonly kind: 'wall'
      readonly sector: string
      /** The corner that starts the wall, in the sector's outline as the document writes it. */
      readonly corner: number
      /** What the wall selects: `wall:<sector>/<corner>`. */
      readonly selection: string
      /** In metres. */
      readonly length: number
      /** Metres from the start of the wall: the point of it nearest the pointer, rounded (5 cm, 1 cm with Shift, none with Alt). */
      readonly along: number
      /** The world point at `along`, where a tap puts the corner. */
      readonly point: Point
    } & VertexEffect)

export interface VertexToolView {
  /** The corner or the wall under the pointer; nothing when none is within the pointer kind's reach. */
  readonly target: VertexTarget | undefined
  readonly refusal: string | undefined
}

export interface VertexTool {
  readonly view: VertexToolView
  /** Called after `view` changes; returns a way to stop. */
  subscribe(run: () => void): () => void
  hover(at: PlanPointer): void
  /** The pointer left the canvas. */
  leave(): void
  tap(at: PlanPointer): void
  /** The canvas has a new size: the camera keeps its centre. */
  resize(size: Size): void
  /** Stops following the editor. */
  dispose(): void
}

/** Equal as data: a view is a few points and a few names. */
const same = (a: unknown, b: unknown): boolean => JSON.stringify(a) === JSON.stringify(b)

/** What names a target while the pointer stays on it: the sentence of a refused tap lives as long as that. */
const keyOf = (target: VertexTarget): string =>
  target.kind === 'wall' ? target.selection : `corner:${target.sector}/${target.corner}`

export function createVertexTool<D>(editor: LevelEditor<D>, canvas: Size): VertexTool {
  const listeners = new Set<() => void>()
  let size = canvas
  let view: VertexToolView = { target: undefined, refusal: undefined }
  let pointer: PlanPointer | undefined
  const geometry = createGeometryCache(editor)

  const currentViewport = (): Viewport2D => planViewport(editor.view.state.camera, size)

  const removal = (corner: { readonly sector: string; readonly corner: number }): Edit<D> =>
    removeCorner({ sector: corner.sector, corner: corner.corner })
  const insertion = (wall: {
    readonly sector: string
    readonly corner: number
    readonly point: Point
  }): Edit<D> => insertCorner({ sector: wall.sector, corner: wall.corner, x: wall.point.x, z: wall.point.z })

  /** What the edit would do to the live level, without doing it: `action` when it would work, else its sentence. */
  const effectOf = (edit: Edit<D>, action: 'add' | 'remove'): VertexEffect => {
    const trial = edit.run(editor.profile, editor.level)
    return trial.ok ? { action } : { action: 'none', reason: trial.reason }
  }

  /** The corner within the pointer kind's reach, else the wall within it and the place along it, or nothing. */
  const targetAt = (at: PlanPointer): VertexTarget | undefined => {
    const { layers, select } = geometry()
    const { hidden, locked } = editor.view.state
    if (isLayerOff({ hidden, locked }, 'walls')) return undefined
    const radius = PICK_RADIUS[at.kind]
    const viewport = currentViewport()
    const corner = pickCorner(layers, select, viewport, at, { radius })
    if (corner !== undefined) {
      const base = { kind: 'corner', sector: corner.sector, corner: corner.corner, point: corner.at } as const
      return { ...base, ...effectOf(removal(base), 'remove') }
    }
    const hit = wallNear(layers, select, viewport, at, radius)
    const ref = hit === undefined ? undefined : parseSelection(hit.selection)
    if (hit === undefined || ref?.kind !== 'wall') return undefined
    const found = editor.profile.sectors.list(editor.level).find((candidate) => candidate.id === ref.sector)
    const start = found?.corners[ref.corner]
    if (found === undefined || start === undefined) return undefined
    const end = cornerAt(found.corners, ref.corner + 1)
    const length = snapValue(wallLength(found.corners, ref.corner), 0)
    // From the document's start of the wall, the measure the other wall tools use, not the geometry's.
    const distance = Math.hypot(hit.at.x - start[0], hit.at.z - start[1])
    const along = Math.min(length, snapValue(distance, snapStep({ shiftKey: at.shift, altKey: at.alt })))
    // A wall of no length has a neighbour at its point that is as near, and wins the pick, so `length` is not 0 here.
    const fraction = along / length
    const base = {
      kind: 'wall',
      sector: ref.sector,
      corner: ref.corner,
      selection: hit.selection,
      length,
      along,
      point: {
        x: snapValue(start[0] + (end[0] - start[0]) * fraction, 0),
        z: snapValue(start[1] + (end[1] - start[1]) * fraction, 0),
      },
    } as const
    return { ...base, ...effectOf(insertion(base), 'add') }
  }

  /** The sentence of the last refused tap and what it was refused on: it stays while the pointer stays on that target. */
  let refused: { readonly key: string; readonly sentence: string } | undefined

  /**
   * What a tap on `target` does, as one undo step; the sentence that refused it, or nothing when it worked. A target
   * that says `none` is run all the same: the model refuses it with the sentence the target holds.
   */
  const apply = (target: VertexTarget): string | undefined => {
    const result = editor.run(target.kind === 'corner' ? removal(target) : insertion(target))
    return result.ok ? undefined : result.reason
  }

  const publish = (): void => {
    const next: VertexToolView = {
      target: pointer === undefined ? undefined : targetAt(pointer),
      refusal: refused?.sentence,
    }
    if (same(view, next)) return
    view = next
    for (const run of [...listeners]) run()
  }

  const stops = [editor.history.subscribe(publish), editor.view.subscribe(publish)]

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
      if (refused !== undefined) {
        const target = targetAt(at)
        if (target === undefined || keyOf(target) !== refused.key) refused = undefined
      }
      publish()
    },
    leave() {
      pointer = undefined
      refused = undefined
      publish()
    },
    tap(at) {
      pointer = at
      const target = targetAt(at)
      const sentence = target === undefined ? undefined : apply(target)
      refused = target === undefined || sentence === undefined ? undefined : { key: keyOf(target), sentence }
      publish()
    },
    resize(next) {
      size = next
      publish()
    },
    dispose() {
      for (const stop of stops) stop()
      listeners.clear()
    },
  }
}
