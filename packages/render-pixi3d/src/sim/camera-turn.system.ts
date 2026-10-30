import { defineSystem, type SystemDef } from '@mcthaydt/automata-sim'
import { CameraHeading } from './camera-heading.component.js'
import { CameraTurn } from './camera-turn.command.js'
import { turnCamera } from './view-latch.js'

/**
 * Adds up the tick's `camera-turn` commands and turns every `camera-heading` by the sum (clamped, wrapped, ignored
 * under `rotate: false`: `turnCamera`). A game has one player, so every command turns it; the stick mapping uses
 * the new heading from this tick on.
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
