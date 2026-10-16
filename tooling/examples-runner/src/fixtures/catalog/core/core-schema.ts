// core-schema: a command schema from Zod
//
// Shows: a catalog fixture.
// Controls: none
// Packages: @mcthaydt/automata-sim, zod
// Difficulty: ★☆☆☆
// Tier: core
import { defineCommand } from '@mcthaydt/automata-sim'
import { z } from 'zod'

export default { id: 'core-schema', command: defineCommand('jump', z.object({})) }
