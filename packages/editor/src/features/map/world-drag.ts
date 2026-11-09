import type { Camera } from '../../shared/level-2d/canvas/level-view'
import type { EditHistory } from '../../shared/level-2d/editor/level-editor-api'
import { moveLevelInWorld } from '../../shared/level-2d/model/world/level-placement'
import { dragPosition, levelAt, toWorld, worldRects } from '../../shared/level-2d/model/world/world-model'
import type { Point } from '../../shared/level-2d/tiles/footprint'

// A press and drag on the World view's map. A press picks the topmost level
// under the pointer and selects it (or clears the selection on empty space); moving drags it live inside one
// transaction, so the release is one undo step and a cancelled pointer puts it back. A press that never moves only
// selects. The world's layout snaps or reorders through `moveLevelInWorld`.

export interface WorldDragOptions {
  readonly history: EditHistory
  readonly world: () => string
  readonly camera: () => Camera
  readonly onselect: (level: string | undefined) => void
}

export interface WorldDrag {
  down(screen: Point): void
  move(screen: Point): void
  up(): void
  cancel(): void
}

interface Pressed {
  readonly level: string
  readonly from: Point
  readonly start: Point
  transaction: ReturnType<EditHistory['begin']> | undefined
}

export function createWorldDrag(options: WorldDragOptions): WorldDrag {
  const { history } = options
  let pressed: Pressed | undefined

  return {
    down(screen) {
      pressed?.transaction?.cancel()
      pressed = undefined
      const project = history.state
      const world = options.world()
      const level = levelAt(worldRects(project, world, undefined), toWorld(options.camera(), screen))
      options.onselect(level)
      const placement = project.worlds
        .find((candidate) => candidate.id === world)
        ?.placements.find((candidate) => candidate.level === level)
      if (level === undefined || placement === undefined) return
      pressed = { level, from: screen, start: { x: placement.x, y: placement.y }, transaction: undefined }
    },
    move(screen) {
      if (pressed === undefined) return
      const travel = { x: screen.x - pressed.from.x, y: screen.y - pressed.from.y }
      const to = dragPosition(pressed.start, travel, options.camera().scale)
      pressed.transaction ??= history.begin('Move level')
      const { level } = pressed
      pressed.transaction.update((project) => moveLevelInWorld(project, level, to.x, to.y))
    },
    up() {
      pressed?.transaction?.commit()
      pressed = undefined
    },
    cancel() {
      pressed?.transaction?.cancel()
      pressed = undefined
    },
  }
}
