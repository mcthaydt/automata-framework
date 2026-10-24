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
import { insertCorner, removeCorner } from '../model/vertex-edits'
import { planViewport } from '../view/plan/plan-viewport'
import { createGeometryCache } from './geometry-cache'
import type { PlanPointer } from './plan-controller'
import { type OutlinePlace, outlinePlaceAt } from './wall-place'

/** What a tap there would do. */
export type VertexEffect =
  | { readonly action: 'add' | 'remove' }
  /** Nothing: the sentence a tap would be refused with. */
  | { readonly action: 'none'; readonly reason: string }

/** A corner under the pointer: a tap takes it away. A wall within reach and no corner: a tap puts a corner at its `point`. */
export type VertexTarget = OutlinePlace & VertexEffect

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
    const place = outlinePlaceAt(editor, geometry(), currentViewport(), at)
    if (place === undefined) return undefined
    return place.kind === 'corner'
      ? { ...place, ...effectOf(removal(place), 'remove') }
      : { ...place, ...effectOf(insertion(place), 'add') }
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
