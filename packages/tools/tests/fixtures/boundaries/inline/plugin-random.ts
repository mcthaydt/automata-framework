import { definePlugin } from '@automata/framework'

export const plugin = definePlugin({ defs: [], setup: ({ spawn }) => spawn({ x: Math.random() }) })
