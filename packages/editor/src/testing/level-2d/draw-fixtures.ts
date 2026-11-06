import type { DrawView } from '../../shared/level-2d/canvas/draw/draw-list-types'
import { decodeProject } from '../../shared/level-2d/model/project-codec'
import type { Project } from '../../shared/level-2d/model/project-types'
import { richProjectFile } from './projects'

// Inputs for the draw-list tests (ED2D.4c3a): the rich fixture as a project, and a Level view state that names its
// level `start` and the `decor` tiles layer, with the brush and nothing hidden, locked, hovered or selected.

export function richProject(): Project {
  const result = decodeProject(richProjectFile())
  if (!result.ok) throw new Error('the rich fixture should decode')
  return result.project
}

export function drawView(patch: Partial<DrawView> = {}): DrawView {
  return {
    level: 'start',
    layer: 'decor',
    tool: 'brush',
    brushSize: 1,
    hover: undefined,
    rectangle: undefined,
    selected: [],
    hidden: new Set(),
    locked: new Set(),
    ...patch,
  }
}
