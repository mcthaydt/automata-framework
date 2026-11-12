import { definePlugin } from '@automataframework/framework'

export const plugin = definePlugin({ defs: [], setup: ({ spawn }) => spawn({ x: Math.random() }) })
