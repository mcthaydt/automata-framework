import type { LevelEditor } from '../../shared/edit/level-editor'
import { createPlanTools, type PlanTools } from './plan/plan-tools'

// The Plan view's tools in the editor suite (plan ED3D.6g-a): the suite's top bar shows these tools (`Levels3dTools`), and the
// canvas needs the same ones to route its pointer and camera. One set per level editor, kept beside it like the
// suite's pointer, so a switch away and back finds them as they were; the canvas sizes them when it measures itself.

const kept = new WeakMap<LevelEditor<unknown>, PlanTools>()

export function planToolsOf(editor: LevelEditor<unknown>): PlanTools {
  let tools = kept.get(editor)
  if (tools === undefined) {
    tools = createPlanTools(editor, { w: 1, h: 1 })
    kept.set(editor, tools)
  }
  return tools
}
