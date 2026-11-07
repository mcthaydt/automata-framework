// The Plan view's Merge tool as plain TypeScript (ED3D.6f, ED3D spec §5.3 flow 3, §5.4 and the Sector toolbar of §7): a tap
// on a room picks the one that stays, a second tap on the room beside it takes that one into it by `mergeSectors`. No
// Svelte, DOM, Pixi or clock in here: the view forwards what the kit's gesture recogniser says (canvas pixels, the pointer
// kind and the modifier keys, as for the other tools), reads `view` and paints the two rooms and what a tap would do. The
// level, the selection and the camera stay in the editor; the tool keeps only the room that stays.
//
// The target is a dry run of the edit, as the Vertex and Split tools': once the first room is picked, `view.target` says
// what a tap would do by running `mergeSectors` against the live level and not committing it, so the tool cannot disagree
// with the model about what is allowed, and a refusal is the model's own sentence. The first room does not outlive the
// level it was picked on: an edit, an undo or a redo drops it.
import type { Size, Viewport2D } from '@automata/editor/kit/core'
import type { LevelEditor } from '../model/level-editor'
import { mergeSectors } from '../model/merge-edits'
import { pinnedProblem } from '../model/sector-edit-support'
import { isLayerOff, PICK_RADIUS, pickPlan } from '../view/plan/plan-pick'
import { planViewport } from '../view/plan/plan-viewport'
import { createGeometryCache } from './geometry-cache'
import type { PlanPointer } from './plan-controller'

/** What a tap there would do. */
export type MergeEffect =
  /** Pick this room as the one that stays. */
  | { readonly action: 'keep' }
  /** Take this room into the one that stays. */
  | { readonly action: 'merge' }
  /** Nothing: the sentence a tap would be refused with. */
  | { readonly action: 'none'; readonly reason: string }

/** The room under the pointer and what a tap on it would do. */
export type MergeTarget = { readonly sector: string } & MergeEffect

export interface MergeToolView {
  /** The room that stays, once picked. */
  readonly keep: string | undefined
  /** The room under the pointer; nothing when none is within the pointer kind's reach. */
  readonly target: MergeTarget | undefined
  readonly refusal: string | undefined
}

export interface MergeTool {
  readonly view: MergeToolView
  /** Called after `view` changes; returns a way to stop. */
  subscribe(run: () => void): () => void
  hover(at: PlanPointer): void
  /** The pointer left the canvas. The room that stays is kept: a finger lifts between two taps. */
  leave(): void
  /** Picks the room that stays, or takes the room under the tap into it; the model's sentence says why a tap was refused. */
  tap(at: PlanPointer): void
  /** Takes the room that stays back. */
  cancel(): void
  /** The canvas has a new size: the camera keeps its centre. */
  resize(size: Size): void
  /** Stops following the editor. */
  dispose(): void
}

/** Equal as data: a view is a few names. */
const same = (a: unknown, b: unknown): boolean => JSON.stringify(a) === JSON.stringify(b)

export function createMergeTool<D>(editor: LevelEditor<D>, canvas: Size): MergeTool {
  const listeners = new Set<() => void>()
  let size = canvas
  let view: MergeToolView = { keep: undefined, target: undefined, refusal: undefined }
  let pointer: PlanPointer | undefined
  /** The room that stays and the level it was picked on: an edit, an undo or a redo makes it stale. */
  let picked: { readonly sector: string; readonly level: D } | undefined
  /** The sentence of the last refused tap and the room it was refused on: it stays while the pointer stays there. */
  let refused: { readonly sector: string; readonly sentence: string } | undefined
  const geometry = createGeometryCache(editor)

  const currentViewport = (): Viewport2D => planViewport(editor.view.state.camera, size)

  /** Drops a room that was picked on a level the editor no longer has. */
  const fresh = (): void => {
    if (picked !== undefined && picked.level !== editor.level) {
      picked = undefined
      refused = undefined
    }
  }

  /** What a tap on the room would do: pick it, or take it into the room that stays, or why neither. */
  const effectOf = (sector: string): MergeEffect => {
    if (picked === undefined) {
      const reason = pinnedProblem(editor.profile, editor.level, sector, 'merged')
      return reason === undefined ? { action: 'keep' } : { action: 'none', reason }
    }
    const trial = mergeSectors<D>({ keep: picked.sector, merge: sector }).run(editor.profile, editor.level)
    return trial.ok ? { action: 'merge' } : { action: 'none', reason: trial.reason }
  }

  /** The room the pointer touches: the wall within the kind's reach (of the room the pointer is in), else the room that holds it. */
  const sectorAt = (at: PlanPointer): string | undefined => {
    const { layers, select } = geometry()
    const { hidden, locked } = editor.view.state
    if (isLayerOff({ hidden, locked }, 'sectors')) return undefined
    return pickPlan(layers, select, currentViewport(), at, {
      radius: PICK_RADIUS[at.kind],
      hidden,
      locked,
    })?.sector
  }

  const targetAt = (at: PlanPointer): MergeTarget | undefined => {
    const sector = sectorAt(at)
    return sector === undefined ? undefined : { sector, ...effectOf(sector) }
  }

  const publish = (): void => {
    fresh()
    const next: MergeToolView = {
      keep: picked?.sector,
      target: pointer === undefined ? undefined : targetAt(pointer),
      refusal: refused?.sentence,
    }
    if (same(view, next)) return
    view = next
    for (const run of [...listeners]) run()
  }

  /** Picks the room that stays, or merges the room into it; the sentence that refused the tap, or nothing when it worked. */
  const apply = (target: MergeTarget): string | undefined => {
    if (picked === undefined) {
      // A room the model would not merge at all is refused here, with the sentence the target holds.
      if (target.action === 'none') return target.reason
      picked = { sector: target.sector, level: editor.level }
      return undefined
    }
    // A merge that worked changed the level, which makes the picked room stale: `fresh` drops it.
    const result = editor.run(mergeSectors<D>({ keep: picked.sector, merge: target.sector }))
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
      if (refused !== undefined && sectorAt(at) !== refused.sector) refused = undefined
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
      const before = picked
      const sentence = target === undefined ? undefined : apply(target)
      refused =
        target === undefined || sentence === undefined ? undefined : { sector: target.sector, sentence }
      // The tap that picked the room has nothing to show under it: the room cannot be merged with itself.
      if (before === undefined && picked !== undefined) pointer = undefined
      publish()
    },
    cancel() {
      picked = undefined
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
