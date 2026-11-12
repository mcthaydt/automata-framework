// core-schema: a command schema from Zod
//
// Shows: a catalog fixture.
// Controls: none
// Packages: @automataframework/framework, zod
// Difficulty: ★☆☆☆
// Tier: core
import { defineCommand } from '@automataframework/framework'
import { z } from 'zod'

export default { id: 'core-schema', command: defineCommand('jump', z.object({})) }
