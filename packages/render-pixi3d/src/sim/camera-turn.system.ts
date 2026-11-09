import { defineSystem, type SystemDef } from '@automataframework/automata-sim'
import { CameraHeading } from './camera-heading.component.js'
import { CameraTurn } from './camera-turn.command.js'
import { turnCamera } from './view-latch.js'

/**
 * Adds up the tick's `camera-turn` commands and turns every `camera-heading` by the sum (clamped, wrapped, ignored
 * under `rotate: false`: `turnCamera`). A game has one player, so every command turns it. It runs in the `input`
 * phase, so a game system that maps the stick later in the tick reads the turned heading: the spec's "from the next
 * tick" (§5) counts from the tick the input was sampled in, since a command reaches the sim in the step after.
 */
export const cameraTurnSystem: SystemDef = defineSystem({
  name: 'camera.turn',
  phase: 'input',
  run(ctx) {
    let units = 0
    for (const command of ctx.commands.of(CameraTurn)) units += command.payload.units
    if (units === 0) return
    for (const entity of ctx.query(CameraHeading))
      entity.set(CameraHeading, turnCamera(entity.get(CameraHeading), units))
  },
})
