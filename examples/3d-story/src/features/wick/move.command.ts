import { STICK_MAX } from '@automata/3d/sim'
import { defineCommand } from '@automata/sim'
import { z } from 'zod'

const axis = z.int().min(-STICK_MAX).max(STICK_MAX)

/** Where the stick is: -127 to 127 on each axis, y positive down. Sent every tick; no command is a centred stick. */
export const Move = defineCommand('move', z.object({ x: axis, y: axis }))
