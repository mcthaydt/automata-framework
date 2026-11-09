import { definePlugin, defineSystem, sortedKeys } from '@automataframework/automata'

const move = defineSystem('move', ({ commands, query }) => {
  for (const { x } of commands()) for (const body of query()) body.x = Math.max(0, body.x + x)
  return sortedKeys({ b: 1, a: 2 })
})

export const plugin = definePlugin({ defs: [move], setup: ({ spawn }) => spawn({ x: 1 }) })
