import { defineSystem } from '@automataframework/automata'

document.title = `started at ${Date.now()}`
console.log('a browser file may use the DOM, the clock and the console outside the sim')

export const move = defineSystem({
  name: 'move',
  run(ctx) {
    for (const body of ctx.query()) body.x = Math.floor(body.x + 1)
  },
})
