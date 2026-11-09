import { definePlugin } from '@automataframework/automata'

export const plugin = definePlugin({ defs: [], setup: ({ spawn }) => spawn({ x: Math.random() }) })
