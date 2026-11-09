// core-schema: a command schema from Zod
//
// Shows: a catalog fixture.
// Controls: none
// Packages: @automataframework/automata, zod
// Difficulty: ★☆☆☆
// Tier: core
import { defineCommand } from '@automataframework/automata'
import { z } from 'zod'

export default { id: 'core-schema', command: defineCommand('jump', z.object({})) }
