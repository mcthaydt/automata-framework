import { defineSystem } from '@automataframework/automata'
import { trait } from 'koota'

document.title = 'file-level browser code may use the DOM'
export const Position = trait({ x: 0, y: 0 })

export const move = defineSystem({
  name: 'move',
  run(ctx) {
    for (const body of ctx.query()) body.x = Math.floor(body.x + 1)
  },
})
