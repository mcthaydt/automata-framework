import { defineSystem, type SystemDef } from '@automata/sim'
import { CameraHeading } from './camera-heading.component.ts'
import { CameraTurn } from './camera-turn.command.ts'
import { turnCamera } from './view-latch.ts'

/**
 * Adds up the tick's `camera-turn` commands and turns every `camera-heading` one 45° step toward the sum's sign (wrapped, ignored
 * under `rotate: false`: `turnCamera`). A game has one player, so every command turns it. It runs in the `input`
 * phase, so a game system that maps the stick later in the tick reads the turned heading: the spec's "from the next
 * tick" counts from the tick the input was sampled in, since a command reaches the sim in the step after.
 */
export const cameraTurnSystem: SystemDef = defineSystem({
  name: 'camera.turn',
  phase: 'input',
  run(ctx) {
    let units = 0
    for (const command of ctx.commands.of(CameraTurn)) units += command.payload.units
    // Every tick, even with no command: a tick with no turn is the key let go.
    for (const entity of ctx.query(CameraHeading)) {
      const state = entity.get(CameraHeading)
      const next = turnCamera(state, units)
      if (next !== state) entity.set(CameraHeading, next)
    }
  },
})
