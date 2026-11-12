import { CutsceneState } from '@automata/cutscenes/sim'
import { InSector } from '@automata/sectors/sim'
import { defineSystem } from '@automata/sim'
import { Ada } from '../../shared/ada.component.ts'
import { playIn } from '../../shared/play-content.ts'

/** How near, in metres, a cutscene's last place for her must be to where she stands for it to count as "where she stands". */
const SAME_PLACE = 0.01

/**
 * A cutscene that leaves Ada where she stands leaves her facing as its last key for her says: the old opening ends with
 * `facing: 0`, and play starts "where the cutscene leaves it, with her whole and facing us". The stage, not the sim, draws her while
 * the scene runs (its keys place the figure each frame), so the sim sets her heading on the tick the scene starts and a skip, which
 * can end it on any tick, finds it already there. A scene that moves her elsewhere (it keys another place) is not about her heading,
 * and she keeps the one she had.
 */
export const settle = defineSystem({
  name: 'ada.settle',
  phase: 'gameplay',
  before: ['ada.face'],
  run: (ctx) => {
    const state = ctx.resource(CutsceneState)
    if (state.id === null || state.start !== ctx.tick) return
    const keys = playIn(ctx.content).scripts.find((script) => script.id === state.id)?.actor
    const last = keys?.filter((key) => key.who === 'player' && key.facing !== undefined).at(-1)
    if (last === undefined) return
    for (const ada of ctx.query(Ada, InSector)) {
      const here = ada.get(InSector)
      if (Math.hypot(here.x - (last.x ?? here.x), here.z - (last.z ?? here.z)) > SAME_PLACE) continue
      ada.set(Ada, { ...ada.get(Ada), yaw: last.facing as number })
    }
  },
})
