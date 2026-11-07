import { defineSystem, type SystemDef } from '@automata/sim'
import { AIR_JUMPS, Body, GRAVITY, JUMP_SPEED } from './body.component.ts'
import { Jump } from './jump.command.ts'

// Step 2 of the flow: the rule. A system reads this tick's commands and components and writes components. No
// clock, no Math.random, no I/O: the same commands always give the same result (pnpm boundaries checks it).

export const doubleJump: SystemDef = defineSystem({
  name: 'double-jump',
  phase: 'physics',
  run(ctx) {
    const pressed = ctx.commands.of(Jump).length > 0
    for (const entity of ctx.query(Body)) {
      const body = { ...entity.get(Body) }
      const onFloor = body.y === 0
      if (onFloor) body.airJumps = AIR_JUMPS

      if (pressed && onFloor) {
        body.vy = JUMP_SPEED
      } else if (pressed && body.airJumps > 0) {
        body.vy = JUMP_SPEED // the double jump: a fresh jump speed, whatever the fall speed was
        body.airJumps -= 1
      }

      body.vy -= GRAVITY
      body.y += body.vy
      if (body.y <= 0) {
        body.y = 0
        body.vy = 0
      }
      entity.set(Body, body)
    }
  },
})
