import { defineSystem, type SystemDef } from '@mcthaydt/automata-sim'
import { PlayerControl } from '../../shared/player.component.ts'
import { Move } from './move.command.ts'

/** Copies this tick's `move` command onto the character. No command means nothing is held. */
export const playerInput: SystemDef = defineSystem({
  name: 'player.input',
  phase: 'input',
  run(ctx) {
    const commands = ctx.commands.of(Move)
    const last = commands[commands.length - 1]
    const moveX = last === undefined ? 0 : last.payload.x
    const jump = last === undefined ? false : last.payload.jump
    for (const entity of ctx.query(PlayerControl)) {
      const control = entity.get(PlayerControl)
      entity.set(PlayerControl, { moveX, jumpHeld: jump, jumpPressed: jump && !control.jumpHeld })
    }
  },
})
