// core-schema: a command schema from Zod
//
// Shows: a catalog fixture.
// Controls: none
// Packages: @automata/framework, zod
// Difficulty: ★☆☆☆
// Tier: core
import { defineCommand } from '@automata/framework'
import { z } from 'zod'

export default { id: 'core-schema', command: defineCommand('jump', z.object({})) }
