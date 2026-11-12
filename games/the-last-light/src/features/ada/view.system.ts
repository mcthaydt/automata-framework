import { CameraHeading, enterView } from '@automata/3d/sim'
import { InSector, resolvedMap } from '@automata/sectors/sim'
import { defineSystem } from '@automata/sim'
import { Ada } from '../../shared/ada.component.ts'
import { playIn } from '../../shared/play-content.ts'
import { Move } from './move.command.ts'

/**
 * Puts Ada's camera in the view of the room she stands in. The level says which view each room takes; entering another takes
 * its heading at once and, with the stick held, latches the stick's mapping to the old heading (`enterView`), so a walk
 * across a doorway does not turn under her hand.
 */
export const view = defineSystem({
  name: 'ada.view',
  phase: 'gameplay',
  after: ['ada.face'],
  run: (ctx) => {
    const play = playIn(ctx.content)
    const sectors = resolvedMap(ctx).sectors
    const moves = ctx.commands.of(Move)
    const stick = moves[moves.length - 1]?.payload ?? { x: 0, y: 0 }
    for (const ada of ctx.query(Ada, CameraHeading, InSector)) {
      // `sector` is the room's place in the map plus one; 0 is outside every room (the view she has stays).
      const room = sectors[ada.get(InSector).sector - 1]
      const id = room === undefined ? undefined : play.viewOf[room.id]
      const heading = ada.get(CameraHeading)
      if (id === undefined || id === heading.view) continue
      const next = play.views.find((each) => each.id === id)
      if (next !== undefined) ada.set(CameraHeading, enterView(heading, next, stick))
    }
  },
})
