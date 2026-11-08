import { definePlugin } from '@mcthaydt/automata'

export const plugin = definePlugin({ defs: [], setup: ({ spawn }) => spawn({ x: Math.random() }) })
