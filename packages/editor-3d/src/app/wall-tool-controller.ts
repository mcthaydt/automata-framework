// The Plan view's wall tools as plain TypeScript (ED3D.6b, ED3D spec §5.3 flow 3 and §5.4): the Portal, Door and Window
// tools, which turn the pointer on a wall into a portal into the sector behind it, or a door or a window on it where the
// pointer is. No Svelte, DOM, Pixi or clock in here: the view forwards what the kit's gesture recogniser says (canvas
// pixels, the pointer kind and the modifier keys, as for the other tools), reads `view` and paints the wall, the tick
// along it and what a tap would do. The level, the selection and the camera stay in the editor.
import type { Size, Viewport2D } from '@mcthaydt/automata-editor/kit/core'
import type { LevelEditor } from '../model/level-editor'
import { wallPortal } from '../model/portal-offers'
import { setDoor, setWallKind, setWindow } from '../model/wall-edits'
import type { EditWall } from '../profile/sector-access'
import { isLayerOff, PICK_RADIUS, wallNear } from '../view/plan/plan-pick'
import { planViewport } from '../view/plan/plan-viewport'
import { createGeometryCache } from './geometry-cache'
import type { PlanPointer } from './plan-controller'
import { type WallPlace, wallPlaceOf } from './wall-place'

export type WallToolKind = 'portal' | 'door' | 'window'

/** What a tap on a wall would do there. */
export type WallEffect =
  /** Put the feature on the wall, or move the one it has. */
  | { readonly action: 'place' | 'move' }
  /** Make the wall a portal into the sector behind it. */
  | { readonly action: 'portal'; readonly to: string }
  /** Nothing: the sentence a tap would be refused with. */
  | { readonly action: 'none'; readonly reason: string }

export type WallTarget = WallPlace & WallEffect

export interface WallToolView {
  /** The wall under the pointer; nothing when none is within the pointer kind's reach. */
  readonly target: WallTarget | undefined
  readonly refusal: string | undefined
}

export interface WallToolOptions {
  readonly kind: WallToolKind
}

export interface WallTool {
  readonly view: WallToolView
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

const NO_WALL_OVER = 'no other sector has a wall over this one'

export function createWallTool<D>(editor: LevelEditor<D>, canvas: Size, options: WallToolOptions): WallTool {
  const listeners = new Set<() => void>()
  let size = canvas
  let view: WallToolView = { target: undefined, refusal: undefined }
  let pointer: PlanPointer | undefined
  const geometry = createGeometryCache(editor)

  const currentViewport = (): Viewport2D => planViewport(editor.view.state.camera, size)

  /** What a tap on this wall would do: the model's answer for a portal, and for a door or window whether the wall can take it. */
  const effect = (id: string, corner: number, wall: string | EditWall | undefined): WallEffect => {
    if (options.kind === 'portal') {
      const answer = wallPortal(editor.profile, editor.level, id, corner)
      if (answer.kind === 'offer') return { action: 'portal', to: answer.offer.to }
      if (answer.kind === 'done')
        return { action: 'none', reason: `that wall is already a portal into ${answer.to}` }
      if (answer.kind === 'taken')
        return { action: 'none', reason: `the wall over it already leads into ${answer.to}` }
      return { action: 'none', reason: NO_WALL_OVER }
    }
    const leadsTo = editor.profile.sectors.portalOf(editor.level, wall)
    if (leadsTo !== undefined)
      return { action: 'none', reason: `that wall is a portal into ${leadsTo}: make it solid first` }
    return { action: typeof wall === 'object' && wall[options.kind] !== undefined ? 'move' : 'place' }
  }

  /** The wall within the pointer kind's reach and the place along it, or nothing. */
  const targetAt = (at: PlanPointer): WallTarget | undefined => {
    const { layers, select } = geometry()
    const { hidden, locked } = editor.view.state
    if (isLayerOff({ hidden, locked }, 'walls')) return undefined
    const hit = wallNear(layers, select, currentViewport(), at, PICK_RADIUS[at.kind])
    const placed = hit === undefined ? undefined : wallPlaceOf(editor, hit, at)
    if (placed === undefined) return undefined
    return { ...placed.place, ...effect(placed.place.sector, placed.place.corner, placed.wall) }
  }

  /** The sentence of the last refused tap and the wall it was refused on: it stays while the pointer stays on that wall. */
  let refused: { readonly selection: string; readonly sentence: string } | undefined

  /** The width of the door or window the wall has now, which the level as it is shows. */
  const widthOf = (target: WallPlace, kind: 'door' | 'window'): number => {
    const wall = editor.profile.sectors.list(editor.level).find((each) => each.id === target.sector)?.corners[
      target.corner
    ]?.[2]
    return (typeof wall === 'object' ? wall[kind]?.width : undefined) ?? 0
  }

  /** What a tap on `target` does, as one undo step; the sentence that refused it, or nothing when it worked. */
  const apply = (target: WallTarget): string | undefined => {
    if (target.action === 'none') return target.reason
    const wall = { sector: target.sector, corner: target.corner }
    if (target.action === 'portal') {
      const result = editor.run(setWallKind({ ...wall, kind: 'portal', to: target.to }))
      if (!result.ok) return result.reason
    } else if (options.kind !== 'portal') {
      const { kind } = options
      const session = editor.begin(
        target.action === 'place'
          ? `Put a ${kind} on wall ${target.corner} of ${target.sector}`
          : `Move the ${kind} of wall ${target.corner} of ${target.sector}`,
      )
      const made = target.action === 'place' ? session.run(setWallKind({ ...wall, kind })) : undefined
      if (made?.ok === false) {
        session.cancel()
        return made.reason
      }
      // The whole feature lies on the wall: its centre is half its width in from either end.
      const half = widthOf(target, kind) / 2
      const at = Math.min(Math.max(target.along, half), target.length - half)
      const placed = session.run(kind === 'door' ? setDoor({ ...wall, at }) : setWindow({ ...wall, at }))
      if (!placed.ok) {
        session.cancel()
        return placed.reason
      }
      session.commit()
    }
    editor.selection.set([target.selection])
    return undefined
  }

  const publish = (): void => {
    const next: WallToolView = {
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
      if (refused !== undefined && targetAt(at)?.selection !== refused.selection) refused = undefined
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
      refused =
        target === undefined || sentence === undefined ? undefined : { selection: target.selection, sentence }
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
