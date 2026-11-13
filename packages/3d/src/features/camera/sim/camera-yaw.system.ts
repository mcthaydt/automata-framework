import { defineSystem, type SystemDef } from '@automata/sim'
import { CameraHeading } from './camera-heading.component.ts'
import { CameraYaw } from './camera-yaw.command.ts'
import { yawCamera } from './view-latch.ts'

/**
 * Adds up the tick's `camera-yaw` commands and turns every `camera-heading` by the sum (`yawCamera`: at most 45° a tick,
 * wrapped, ignored under `rotate: false`). In the `input` phase after `camera.turn`, so a game system that maps the stick
 * later in the tick reads the turned heading.
 */
export const cameraYawSystem: SystemDef = defineSystem({
  name: 'camera.yaw',
  phase: 'input',
  after: ['camera.turn'],
  run(ctx) {
    let units = 0
    for (const command of ctx.commands.of(CameraYaw)) units += command.payload.units
    if (units === 0) return
    for (const entity of ctx.query(CameraHeading)) {
      const state = entity.get(CameraHeading)
      const next = yawCamera(state, units)
      if (next !== state) entity.set(CameraHeading, next)
    }
  },
})
