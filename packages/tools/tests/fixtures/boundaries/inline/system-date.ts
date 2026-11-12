import { defineSystem } from '@automataframework/framework'

export const tick = defineSystem('tick', ({ query }) => {
  for (const body of query()) body.at = Date.now()
})
