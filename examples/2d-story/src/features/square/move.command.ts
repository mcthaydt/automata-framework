import { defineCommand } from '@automata/sim'
import { z } from 'zod'

const axis = z.number().int().min(-1).max(1).default(0)

/** What the player holds this tick: -1, 0 or 1 on each axis. */
export const Move = defineCommand('move', z.object({ x: axis, y: axis }))
