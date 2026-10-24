// core-schema: a command schema from Zod
//
// Shows: a catalog fixture.
// Controls: none
// Packages: @mcthaydt/automata, zod
// Difficulty: ★☆☆☆
// Tier: core
import { defineCommand } from '@mcthaydt/automata'
import { z } from 'zod'

export default { id: 'core-schema', command: defineCommand('jump', z.object({})) }
