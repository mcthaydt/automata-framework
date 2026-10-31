import type { SimContext } from '@mcthaydt/automata-sim'
import { anchorsOf } from './anchors'
import { CutsceneScene, CutsceneState } from './cutscene.resource'
import { type CutsceneScript, cutsceneSchema } from './cutscene.schema'

/** Makes `scripts` the scene's cutscenes and drops any under way. Call it from a game system; a bad script throws. */
export function loadCutscenes(ctx: SimContext, scripts: readonly CutsceneScript[]): void {
  const checked = scripts.map((s) => cutsceneSchema.parse(s))
  ctx.resource(CutsceneScene).scripts = checked.map((s) => ({
    id: s.id,
    duration: s.duration,
    anchors: anchorsOf(s),
  }))
  Object.assign(ctx.resource(CutsceneState), { id: null, start: 0, end: 0 })
}
