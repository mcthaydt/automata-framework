// The Plan view's Sector tool as plain TypeScript (ED3D.6a, ED3D spec §5.3 flow 2 and §10): what a pointer does to a sector
// being drawn. No Svelte, DOM, Pixi or clock in here: the view forwards what the kit's gesture recogniser says (canvas
// pixels, the pointer kind and the modifier keys, as for the Select tool), reads `view` and paints the corners, the rubber
// edge with its length, the snap target and the loupe. The level, the selection and the camera stay in the editor; the
// tool keeps only the corners of the drawing, which are not in the document until it is closed.
//
// Closing a sector whose walls lie on a neighbour's wall does not end the step: the sector is in the level, the step is
// still open and `view.offers` lists the portals it could have. Each offer is accepted or declined, and the step ends
// with the last answer (or `finish`), so the sector and the portals it was given are one undo step.
import type { Size, Viewport2D } from '@mcthaydt/automata-editor-kit/core'
import type { Point } from '../format/sector.schema'
import type { EditSession, LevelEditor } from '../model/level-editor'
import { type PortalOffer, portalOffers } from '../model/portal-offers'
import { addSector } from '../model/sector-edits'
import { parseSelection } from '../model/selection-ref'
import { setWallKind } from '../model/wall-edits'
import { PICK_RADIUS } from '../view/plan/plan-pick'
import { type SnapResult, snapPlan } from '../view/plan/plan-snap'
import { planViewport, snapValue, toScreen } from '../view/plan/plan-viewport'
import { createGeometryCache } from './geometry-cache'
import type { PlanPointer } from './plan-controller'

/** One edge of the drawing: a placed one, or the pending one from the last corner to where the pointer would place the next. */
export interface DrawEdge {
  readonly a: Point
  readonly b: Point
  /** In metres. */
  readonly length: number
  readonly pending: boolean
}

export interface SectorToolView {
  readonly corners: readonly Point[]
  /** Where the pointer would place the next corner, and what it snapped to. */
  readonly snap: SnapResult | undefined
  /** The placed edges in order, then the pending one when the pointer is over the plan. */
  readonly edges: readonly DrawEdge[]
  /** A tap now would close the outline: three or more corners and the pointer within reach of the first. */
  readonly closing: boolean
  /** The point the loupe magnifies: the snapped point under a Pencil, the last corner after a nudge. */
  readonly loupe: Point | undefined
  /** The sentence the last refused action gave, until the next change of the drawing. */
  readonly refusal: string | undefined
  /** The portals the closed sector's walls could have, until each is accepted or declined; the step is open while there are any. */
  readonly offers: readonly PortalOffer[]
}

export interface SectorTool {
  readonly view: SectorToolView
  /** Called after `view` changes; returns a way to stop. */
  subscribe(run: () => void): () => void
  hover(at: PlanPointer): void
  /** The pointer left the canvas. */
  leave(): void
  /** Places a corner at the snapped point of the tap. */
  tap(at: PlanPointer): void
  /** Moves the last corner by whole steps of the view's grid (the nudge pad). */
  nudge(dx: number, dz: number): void
  /** Takes the last corner back. */
  undoCorner(): void
  /** Adds the drawn outline as a sector, one undo step; what refuses it (the model's sentence) leaves the corners as they are. */
  close(): void
  /** Makes the wall of offer `index` a portal, on both sides; what refuses it (the model's sentence) leaves the offer. */
  acceptOffer(index: number): void
  /** Leaves the wall of offer `index` solid. */
  declineOffer(index: number): void
  /** Accepts the offers in order, up to the first that is refused. */
  acceptAll(): void
  /** Declines the offers that are left and ends the step. */
  finish(): void
  /** Drops the drawing, or the sector just closed when its portals are still offered. */
  cancel(): void
  /** The canvas has a new size: the camera keeps its centre. */
  resize(size: Size): void
  /** Stops following the editor. */
  dispose(): void
}

const IDLE: SectorToolView = {
  corners: [],
  snap: undefined,
  edges: [],
  closing: false,
  loupe: undefined,
  refusal: undefined,
  offers: [],
}

/** Equal as data: a view is a few points and a few names. */
const same = (a: unknown, b: unknown): boolean => JSON.stringify(a) === JSON.stringify(b)

const samePoint = (a: Point, b: Point): boolean => a.x === b.x && a.z === b.z

const ALREADY_A_CORNER = 'that point is already a corner'
const ANSWER_THE_OFFERS = 'answer the portal offers first'

export interface SectorToolOptions {
  /** The id of the sector being added, from the ids the level has taken: `sector-N`, the lowest N that is free, when not given. */
  readonly id?: ((taken: readonly string[]) => string) | undefined
}

const lowestFree = (taken: readonly string[]): string => {
  for (let n = 1; ; n++) if (!taken.includes(`sector-${n}`)) return `sector-${n}`
}

export function createSectorTool<D>(
  editor: LevelEditor<D>,
  canvas: Size,
  options: SectorToolOptions = {},
): SectorTool {
  const listeners = new Set<() => void>()
  let size = canvas
  let view: SectorToolView = IDLE
  let pointer: PlanPointer | undefined
  let corners: readonly Point[] = []
  /** The sentence of the last refused action, kept until the drawing changes. */
  let refusal: string | undefined
  /** Whether the last thing was a nudge, which puts the loupe on the last corner. */
  let nudged = false
  /** The open step of a sector just closed, and the portals still to answer. */
  let offering: { readonly session: EditSession<D>; readonly offers: readonly PortalOffer[] } | undefined

  const geometry = createGeometryCache(editor)

  const currentViewport = (): Viewport2D => planViewport(editor.view.state.camera, size)

  /** Where `at` would place a corner: a corner or wall of a sector, the axis through the last corner, the grid. */
  const snapOf = (at: PlanPointer): SnapResult => {
    const { layers, select } = geometry()
    const { hidden, locked, grid } = editor.view.state
    return snapPlan(layers, select, currentViewport(), at, {
      radius: PICK_RADIUS[at.kind],
      hidden,
      locked,
      grid,
      shiftKey: at.shift,
      altKey: at.alt,
      from: corners.at(-1),
    })
  }

  /** The view for the drawing and the pointer as they are now. */
  const compute = (): SectorToolView => {
    const snap = pointer === undefined ? undefined : snapOf(pointer)
    const last = corners.at(-1)
    const edges: DrawEdge[] = corners.slice(1).map((b, i) => edge(corners[i] as Point, b, false))
    if (last !== undefined && snap !== undefined && !samePoint(last, snap))
      edges.push(edge(last, { x: snap.x, z: snap.z }, true))
    const closing = pointer !== undefined && reachesFirst(pointer)
    let loupe: Point | undefined
    if (nudged) loupe = last
    else if (pointer?.kind === 'pen' && snap !== undefined) loupe = { x: snap.x, z: snap.z }
    return { corners, snap, edges, closing, loupe, refusal, offers: offering?.offers ?? [] }
  }

  const publish = (): void => {
    const next = compute()
    if (same(view, next)) return
    view = next
    for (const run of [...listeners]) run()
  }

  const edge = (a: Point, b: Point, pending: boolean): DrawEdge => ({
    a,
    b,
    length: snapValue(Math.hypot(b.x - a.x, b.z - a.z), 0),
    pending,
  })

  /** Whether a pointer is within its kind's reach of the first corner, which closes an outline of three or more. */
  const reachesFirst = (at: PlanPointer): boolean => {
    const first = corners[0]
    if (first === undefined || corners.length < 3) return false
    const there = toScreen(currentViewport(), first)
    return Math.hypot(at.x - there.x, at.y - there.y) <= PICK_RADIUS[at.kind]
  }

  /** The one sector the selection names, as a selected sector or the sector of a selected wall: the heights are taken from it. */
  const likeSelected = (): string | undefined => {
    const named = new Set(
      editor.selection.ids.flatMap((id) => {
        const ref = parseSelection(id)
        return ref?.kind === 'sector' || ref?.kind === 'wall' ? [ref.sector] : []
      }),
    )
    return named.size === 1 ? [...named][0] : undefined
  }

  /** Adds the outline as a sector. The step ends here, or stays open for the portals the new walls could have. */
  const closeOutline = (): void => {
    const id = (options.id ?? lowestFree)(editor.profile.sectors.takenIds(editor.level))
    const session = editor.begin(`Draw sector ${id}`)
    const result = session.run(
      addSector({
        id,
        corners: corners.map((corner) => [corner.x, corner.z] as const),
        like: likeSelected(),
      }),
    )
    if (!result.ok) {
      // A session that is closed already (another step is open) ignores the cancel.
      session.cancel()
      refusal = result.reason
    } else {
      const offers = portalOffers(editor.profile, editor.level, id)
      if (offers.length === 0) session.commit()
      else offering = { session, offers }
      corners = []
      nudged = false
      refusal = undefined
    }
    publish()
  }

  /** Whether the offers are unanswered, which holds the drawing still: says why when they are. */
  const held = (): boolean => {
    if (offering === undefined) return false
    refusal = ANSWER_THE_OFFERS
    publish()
    return true
  }

  const remaining = (): number => offering?.offers.length ?? 0

  /** Accepts or declines offer `index`. A refused acceptance keeps the offer; the last answer ends the step. */
  const answer = (index: number, accept: boolean): void => {
    const current = offering
    const offer = current?.offers[index]
    if (current === undefined || offer === undefined) return
    if (accept) {
      const result = current.session.run(
        setWallKind({ sector: offer.sector, corner: offer.corner, kind: 'portal', to: offer.to }),
      )
      if (!result.ok) {
        refusal = result.reason
        publish()
        return
      }
    }
    refusal = undefined
    offering = { session: current.session, offers: current.offers.filter((_, i) => i !== index) }
    if (remaining() === 0) finish()
    else publish()
  }

  /** Keeps the sector with the portals accepted so far, as one undo step. */
  const finish = (): void => {
    if (offering === undefined) return
    const { session } = offering
    offering = undefined
    refusal = undefined
    session.commit()
    publish()
  }

  /** An undo ends the step the offers belong to, and takes the sector with it. */
  const refresh = (): void => {
    if (offering !== undefined && !offering.session.open) offering = undefined
    publish()
  }

  /** Adds a corner unless the point is one already. */
  const place = (point: Point): void => {
    if (corners.some((corner) => samePoint(corner, point))) {
      refusal = ALREADY_A_CORNER
      return
    }
    corners = [...corners, point]
    refusal = undefined
  }

  const stops = [editor.history.subscribe(refresh), editor.view.subscribe(publish)]

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
      nudged = false
      publish()
    },
    leave() {
      pointer = undefined
      nudged = false
      publish()
    },
    tap(at) {
      pointer = at
      nudged = false
      if (held()) return
      if (reachesFirst(at)) {
        closeOutline()
        return
      }
      const snap = snapOf(at)
      place({ x: snap.x, z: snap.z })
      publish()
    },
    nudge(dx, dz) {
      if (held()) return
      const last = corners.at(-1)
      if (last === undefined) {
        refusal = 'place a corner first'
      } else {
        const { step } = editor.view.state.grid
        const moved = { x: snapValue(last.x + dx * step, 0), z: snapValue(last.z + dz * step, 0) }
        const before = corners
        corners = corners.slice(0, -1)
        place(moved)
        // A refused nudge puts the corner back where it was.
        if (corners.length === before.length - 1) corners = before
        else nudged = true
      }
      publish()
    },
    close() {
      if (!held()) closeOutline()
    },
    undoCorner() {
      if (held()) return
      corners = corners.slice(0, -1)
      nudged = false
      refusal = undefined
      publish()
    },
    acceptOffer(index) {
      answer(index, true)
    },
    declineOffer(index) {
      answer(index, false)
    },
    acceptAll() {
      while (remaining() > 0) {
        const before = remaining()
        answer(0, true)
        if (remaining() === before) return
      }
    },
    finish,
    cancel() {
      const open = offering
      offering = undefined
      open?.session.cancel()
      corners = []
      nudged = false
      refusal = undefined
      publish()
    },
    resize(next) {
      size = next
      publish()
    },
    dispose() {
      finish()
      for (const stop of stops) stop()
      listeners.clear()
    },
  }
}
