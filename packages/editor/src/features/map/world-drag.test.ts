import { describe, expect, it } from 'vitest'
import { createHistory, type History } from '../../shared/kit/history/history.ts'
import { counterIds } from '../../shared/level-2d/model/ids'
import type { Placement, Project } from '../../shared/level-2d/model/project-types'
import { setWorldLayout } from '../../shared/level-2d/model/world/world-layout'
import { platformerTemplate } from '../../shared/level-2d/profiles/level-project/templates/platformer'
import { withNewLevel } from '../../testing/level-2d/project-edit'
import { createWorldDrag } from './world-drag'

// A drag on the World view's map (plan ED2D.6b step 5): pressing on a level selects it, moving drags it live, and
// letting go makes the move one undo step; a press that never moves only selects. Positions are screen pixels.

const CAMERA = { x: 0, y: 0, scale: 0.5 }

function setup(layout: 'free' | 'horizontal' = 'free') {
  const base = withNewLevel(platformerTemplate.create(counterIds()), 'level-2', { x: 1000, y: 0 })
  const project = layout === 'free' ? base : setWorldLayout(base, 'main', layout)
  const history: History<Project> = createHistory(project)
  const selected: (string | undefined)[] = []
  const drag = createWorldDrag({
    history,
    world: () => 'main',
    camera: () => CAMERA,
    onselect: (id) => selected.push(id),
  })
  const placement = (level: string): Placement | undefined =>
    history.state.worlds[0]?.placements.find((candidate) => candidate.level === level)
  const first = project.levels[0]?.id ?? ''
  return { history, drag, selected, placement, first }
}

describe('createWorldDrag', () => {
  it('drags a level by the travel over the scale, live, and makes it one undo step on release', () => {
    const { history, drag, selected, placement } = setup()
    // level-2 is at x 1000 world, 500 screen.
    drag.down({ x: 510, y: 10 })
    expect(selected).toEqual(['level-2'])
    drag.move({ x: 520, y: 30 })
    expect(placement('level-2')).toMatchObject({ x: 1020, y: 40 })
    drag.move({ x: 535, y: 30 })
    expect(placement('level-2')).toMatchObject({ x: 1050, y: 40 })
    drag.up()
    expect(history.undoLabel).toBe('Move level')
    history.undo()
    expect(placement('level-2')).toMatchObject({ x: 1000, y: 0 })
    expect(history.canUndo).toBe(false)
  })

  it('only selects on a press that does not move, and adds no step', () => {
    const { history, drag, selected, first } = setup()
    drag.down({ x: 10, y: 10 })
    drag.up()
    expect(selected).toEqual([first])
    expect(history.canUndo).toBe(false)
  })

  it('clears the selection on empty space and drags nothing', () => {
    const { history, drag, selected } = setup()
    drag.down({ x: 490, y: 400 })
    drag.move({ x: 520, y: 430 })
    drag.up()
    expect(selected).toEqual([undefined])
    expect(history.canUndo).toBe(false)
  })

  it('puts the level back when the pointer is cancelled', () => {
    const { history, drag, placement } = setup()
    drag.down({ x: 510, y: 10 })
    drag.move({ x: 600, y: 10 })
    drag.cancel()
    expect(placement('level-2')).toMatchObject({ x: 1000, y: 0 })
    expect(history.canUndo).toBe(false)
  })

  it("reorders a sequence when the level's centre passes its neighbour (6a decision 1)", () => {
    const { history, drag, first } = setup('horizontal')
    const order = (): string[] => history.state.worlds[0]?.placements.map((p) => p.level) ?? []
    expect(order()).toEqual([first, 'level-2'])
    const width = history.state.levels[0]?.size.w ?? 0
    // Press on the first level and drag it right past the second level's centre.
    drag.down({ x: 10, y: 10 })
    drag.move({ x: 10 + width * 1.2 * CAMERA.scale, y: 10 })
    drag.up()
    expect(order()).toEqual(['level-2', first])
    expect(history.undoLabel).toBe('Move level')
  })
})
