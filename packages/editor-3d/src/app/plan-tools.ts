// The Plan view's tools behind one switcher (ED3D.6g-a, plan decision 1; ED3D spec §5.3 flow 2, §9, §10): which tool
// the plan's taps and hovers go to. The Select controller lives as long as the switcher, because it owns the camera's
// pan and zoom whatever the tool; the other tools are made when chosen and disposed when left. Disposing a Sector tool
// finishes its open portal offers (the walls stay solid) and drops an outline that was never closed, so changing tools
// never loses a sector that was drawn, and never leaves half of one. Polygon and Rectangle are one Sector tool in two
// shapes, so changing the shape mid-outline is refused in the tool's own sentence.
import type { PointerKind, Size } from '@mcthaydt/automata-editor-kit/core'
import type { LevelEditor } from '../model/level-editor'
import { createThingsTool, type ThingsTool, type ThingsToolView } from '../things/things-tool-controller'
import { createMergeTool, type MergeTool, type MergeToolView } from './merge-tool-controller'
import { createPlanController, type PlanController, type PlanPointer, type PlanView } from './plan-controller'
import { createSectorTool, type SectorTool, type SectorToolView } from './sector-tool-controller'
import { createSplitTool, type SplitTool, type SplitToolView } from './split-tool-controller'
import { createVertexTool, type VertexTool, type VertexToolView } from './vertex-tool-controller'
import { createWallTool, type WallTool, type WallToolKind, type WallToolView } from './wall-tool-controller'

export type PlanToolId =
  | 'select'
  | 'polygon'
  | 'rectangle'
  | 'split'
  | 'merge'
  | 'vertex'
  | 'portal'
  | 'door'
  | 'window'
  | 'things'

/** The active tool and what it shows. */
export type PlanToolState =
  | { readonly tool: 'select'; readonly view: PlanView }
  | { readonly tool: 'polygon' | 'rectangle'; readonly view: SectorToolView }
  | { readonly tool: 'split'; readonly view: SplitToolView }
  | { readonly tool: 'merge'; readonly view: MergeToolView }
  | { readonly tool: 'vertex'; readonly view: VertexToolView }
  | { readonly tool: WallToolKind; readonly view: WallToolView }
  | { readonly tool: 'things'; readonly view: ThingsToolView }

export interface PlanTools {
  readonly state: PlanToolState
  /** The Select controller: always alive, for pan, zoom and fit. */
  readonly select: PlanController
  /** The kind of the last tap or hover: the nudge pad shows for touch and Pencil only. */
  readonly pointerKind: PointerKind | undefined
  /** The Sector tool while Polygon or Rectangle is chosen. */
  readonly sector: SectorTool | undefined
  /** The Things tool while it is chosen (ED3D.7d). */
  readonly things: ThingsTool | undefined
  /** Calls `run` after the tool or its view changes. Returns the unsubscribe. */
  subscribe(run: () => void): () => void
  choose(tool: PlanToolId): void
  hover(at: PlanPointer): void
  leave(): void
  tap(at: PlanPointer): void
  /** Select drags corners and sectors, Things drags things; the others pan with a touch or mouse drag, and a Pencil drag does nothing. */
  dragStart(press: PlanPointer, at: PlanPointer): void
  drag(at: PlanPointer): void
  dragEnd(at: PlanPointer, cancelled: boolean): void
  resize(size: Size): void
  dispose(): void
}

type Made =
  | { readonly tool: 'polygon' | 'rectangle'; readonly controller: SectorTool }
  | { readonly tool: 'split'; readonly controller: SplitTool }
  | { readonly tool: 'merge'; readonly controller: MergeTool }
  | { readonly tool: 'vertex'; readonly controller: VertexTool }
  | { readonly tool: WallToolKind; readonly controller: WallTool }
  | { readonly tool: 'things'; readonly controller: ThingsTool }

const isWall = (tool: PlanToolId): tool is WallToolKind =>
  tool === 'portal' || tool === 'door' || tool === 'window'

export function createPlanTools<D>(editor: LevelEditor<D>, canvas: Size): PlanTools {
  const listeners = new Set<() => void>()
  let size = canvas
  const select = createPlanController(editor, size)
  let made: Made | undefined
  let stopMade: (() => void) | undefined
  /** The last point of a panning drag, while a drawing tool pans. */
  let panFrom: PlanPointer | undefined
  let pointerKind: PointerKind | undefined

  const notify = (): void => {
    for (const run of [...listeners]) run()
  }
  const stopSelect = select.subscribe(notify)

  function make(tool: Exclude<PlanToolId, 'select'>): Made {
    if (tool === 'polygon' || tool === 'rectangle')
      return { tool, controller: createSectorTool(editor, size, { shape: tool }) }
    if (tool === 'split') return { tool, controller: createSplitTool(editor, size) }
    if (tool === 'merge') return { tool, controller: createMergeTool(editor, size) }
    if (tool === 'vertex') return { tool, controller: createVertexTool(editor, size) }
    if (isWall(tool)) return { tool, controller: createWallTool(editor, size, { kind: tool }) }
    if (tool === 'things') return { tool, controller: createThingsTool(editor, size) }
    throw new Error(`no plan tool ${String(tool)}`)
  }

  function release(): void {
    stopMade?.()
    stopMade = undefined
    made?.controller.dispose()
    made = undefined
  }

  /** The active pointer handler: the made tool, or Select. */
  const active = (): Pick<PlanController, 'hover' | 'leave' | 'tap'> => made?.controller ?? select

  return {
    get state(): PlanToolState {
      if (made === undefined) return { tool: 'select', view: select.view }
      if (made.tool === 'polygon' || made.tool === 'rectangle')
        return { tool: made.controller.view.shape, view: made.controller.view }
      return { tool: made.tool, view: made.controller.view } as PlanToolState
    },
    select,
    get things() {
      return made?.tool === 'things' ? made.controller : undefined
    },
    get sector() {
      return made?.tool === 'polygon' || made?.tool === 'rectangle' ? made.controller : undefined
    },
    subscribe(run) {
      listeners.add(run)
      return () => listeners.delete(run)
    },
    choose(tool) {
      const sector = this.sector
      if (sector !== undefined && (tool === 'polygon' || tool === 'rectangle')) {
        sector.setShape(tool)
        return
      }
      if (made?.tool === tool) return
      release()
      if (tool !== 'select') {
        made = make(tool)
        stopMade = made.controller.subscribe(notify)
      }
      notify()
    },
    get pointerKind() {
      return pointerKind
    },
    hover(at) {
      pointerKind = at.kind
      active().hover(at)
    },
    leave: () => active().leave(),
    tap(at) {
      pointerKind = at.kind
      active().tap(at)
    },
    dragStart(press, at) {
      if (made === undefined) return select.dragStart(press, at)
      // The Things tool drags things (and draws areas) itself; the others pan.
      if (made.tool === 'things') return made.controller.dragStart(press, at)
      panFrom = press.kind === 'pen' ? undefined : press
      this.drag(at)
    },
    drag(at) {
      if (made === undefined) return select.drag(at)
      if (made.tool === 'things') return made.controller.drag(at)
      if (panFrom === undefined) return
      select.panBy(at.x - panFrom.x, at.y - panFrom.y)
      panFrom = at
    },
    dragEnd(at, cancelled) {
      if (made === undefined) return select.dragEnd(at, cancelled)
      if (made.tool === 'things') return made.controller.dragEnd(at, cancelled)
      if (!cancelled) this.drag(at)
      panFrom = undefined
    },
    resize(next) {
      size = next
      select.resize(next)
      made?.controller.resize(next)
    },
    dispose() {
      release()
      stopSelect()
      select.dispose()
      listeners.clear()
    },
  }
}
