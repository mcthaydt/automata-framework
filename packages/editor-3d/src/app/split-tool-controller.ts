// The Plan view's Split tool as plain TypeScript (ED3D.6f, ED3D spec §5.3 flow 3, §5.4 and the Sector toolbar of §7): two
// taps on one sector's outline cut it in two. The first puts the start of the cut at a corner or a place on a wall and
// fixes which sector is cut; the second runs `splitSector` to the place under it. No Svelte, DOM, Pixi or clock in here:
// the view forwards what the kit's gesture recogniser says (canvas pixels, the pointer kind and the modifier keys, as for
// the other tools), reads `view` and paints the start, the cut with its length and what a tap would do. The level, the
// selection and the camera stay in the editor; the tool keeps only the start, which is not in the document until the cut
// is made.
//
// The target is a dry run of the edit, as the Vertex tool's is: once the start is placed, `view.target` says what a tap
// would do by running `splitSector` against the live level and not committing it, so the tool cannot disagree with the
// model about what is allowed, and a refusal is the model's own sentence. A start does not outlive the level it was placed
// on: an edit, an undo or a redo drops it.

import type { Point } from '@automata/3d/level'
import type { Size, Viewport2D } from '@automata/editor/kit/core'
import type { LevelEditor } from '../model/level-editor'
import { cutProblem, splitSector } from '../model/split-edits'
import { planViewport, snapValue } from '../view/plan/plan-viewport'
import { createGeometryCache } from './geometry-cache'
import type { PlanPointer } from './plan-controller'
import { lowestFreeId } from './sector-id'
import { type OutlinePlace, outlinePlaceAt } from './wall-place'

/** What a tap there would do. */
export type SplitEffect =
  /** Put the start of the cut here. */
  | { readonly action: 'start' }
  /** Cut the sector from the start to here. */
  | { readonly action: 'cut' }
  /** Nothing: the sentence a tap would be refused with. */
  | { readonly action: 'none'; readonly reason: string }

/** A corner or a place on a wall under the pointer, and what a tap there would do. */
export type SplitTarget = OutlinePlace & SplitEffect

export interface SplitToolView {
  /** The start of the cut, once placed; the sector it fixes is the one cut. */
  readonly start: { readonly sector: string; readonly point: Point } | undefined
  /** The corner or the wall under the pointer; nothing when none is within the pointer kind's reach. */
  readonly target: SplitTarget | undefined
  /** The cut a tap would make, from the start to the target, whether or not the model allows it; `length` in metres. */
  readonly cut: { readonly a: Point; readonly b: Point; readonly length: number } | undefined
  readonly refusal: string | undefined
}

export interface SplitToolOptions {
  /** The id of the new sector, from the ids the level has taken: `sector-N`, the lowest N that is free, when not given. */
  readonly id?: ((taken: readonly string[]) => string) | undefined
}

export interface SplitTool {
  readonly view: SplitToolView
  /** Called after `view` changes; returns a way to stop. */
  subscribe(run: () => void): () => void
  hover(at: PlanPointer): void
  /** The pointer left the canvas. The start stays: a finger lifts between two taps. */
  leave(): void
  /** Puts the start of the cut, or makes the cut to here; the model's sentence says why a tap was refused. */
  tap(at: PlanPointer): void
  /** Takes the start back. */
  cancel(): void
  /** The canvas has a new size: the camera keeps its centre. */
  resize(size: Size): void
  /** Stops following the editor. */
  dispose(): void
}

/** Equal as data: a view is a few points and a few names. */
const same = (a: unknown, b: unknown): boolean => JSON.stringify(a) === JSON.stringify(b)

const pointOf = (place: OutlinePlace): Point => ({ x: place.point.x, z: place.point.z })

/** What names a place while the pointer stays on it: the sentence of a refused tap lives as long as that. */
const keyOf = (place: OutlinePlace): string => `${place.sector}@${place.point.x},${place.point.z}`

export function createSplitTool<D>(
  editor: LevelEditor<D>,
  canvas: Size,
  options: SplitToolOptions = {},
): SplitTool {
  const listeners = new Set<() => void>()
  let size = canvas
  let view: SplitToolView = { start: undefined, target: undefined, cut: undefined, refusal: undefined }
  let pointer: PlanPointer | undefined
  /** The start of the cut and the level it was placed on: an edit, an undo or a redo makes it stale. */
  let started: { readonly sector: string; readonly point: Point; readonly level: D } | undefined
  /** The sentence of the last refused tap and the place it was refused on: it stays while the pointer stays there. */
  let refused: { readonly key: string; readonly sentence: string } | undefined
  const geometry = createGeometryCache(editor)

  const currentViewport = (): Viewport2D => planViewport(editor.view.state.camera, size)

  /** Drops a start that was placed on a level the editor no longer has. */
  const fresh = (): void => {
    if (started !== undefined && started.level !== editor.level) {
      started = undefined
      refused = undefined
    }
  }

  const newId = (): string => (options.id ?? lowestFreeId)(editor.profile.sectors.takenIds(editor.level))

  /** The cut from the start to `place` as an edit. */
  const cutTo = (sector: string, from: Point, place: OutlinePlace) =>
    splitSector<D>({ sector, id: newId(), from, to: pointOf(place) })

  /** What a tap on `place` would do: put the start, or cut to it, or why neither. */
  const effectOf = (place: OutlinePlace): SplitEffect => {
    if (started === undefined) {
      const reason = cutProblem(editor.profile, editor.level, place.sector)
      return reason === undefined ? { action: 'start' } : { action: 'none', reason }
    }
    const trial = cutTo(started.sector, started.point, place).run(editor.profile, editor.level)
    return trial.ok ? { action: 'cut' } : { action: 'none', reason: trial.reason }
  }

  /** The corner or wall place within the pointer kind's reach and what a tap there does, or nothing. */
  const targetAt = (at: PlanPointer): SplitTarget | undefined => {
    const place = outlinePlaceAt(editor, geometry(), currentViewport(), at)
    return place && { ...place, ...effectOf(place) }
  }

  const cutOf = (target: SplitTarget | undefined): SplitToolView['cut'] => {
    if (started === undefined || target === undefined) return undefined
    const b = pointOf(target)
    return {
      a: started.point,
      b,
      length: snapValue(Math.hypot(b.x - started.point.x, b.z - started.point.z), 0),
    }
  }

  const publish = (): void => {
    fresh()
    const target = pointer === undefined ? undefined : targetAt(pointer)
    const next: SplitToolView = {
      start: started && { sector: started.sector, point: started.point },
      target,
      cut: cutOf(target),
      refusal: refused?.sentence,
    }
    if (same(view, next)) return
    view = next
    for (const run of [...listeners]) run()
  }

  /** Puts the start at the target, or makes the cut to it; the sentence that refused the tap, or nothing when it worked. */
  const apply = (target: SplitTarget): string | undefined => {
    if (started === undefined) {
      // A start that the model would not cut from at all is refused here, with the sentence the target holds.
      if (target.action === 'none') return target.reason
      started = { sector: target.sector, point: pointOf(target), level: editor.level }
      return undefined
    }
    // A cut that worked changed the level, which makes the start stale: `fresh` drops it.
    const result = editor.run(cutTo(started.sector, started.point, target))
    return result.ok ? undefined : result.reason
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
        const place = outlinePlaceAt(editor, geometry(), currentViewport(), at)
        if (place === undefined || keyOf(place) !== refused.key) refused = undefined
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
      const before = started
      const sentence = target === undefined ? undefined : apply(target)
      refused = target === undefined || sentence === undefined ? undefined : { key: keyOf(target), sentence }
      // The tap that placed the start has nothing to show under it: the cut would be of no length.
      if (before === undefined && started !== undefined) pointer = undefined
      publish()
    },
    cancel() {
      started = undefined
      refused = undefined
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
