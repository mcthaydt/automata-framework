import { definePlugin } from '@automata/sim'
import { Hero } from './hero.component.ts'
import { Move } from './move.command.ts'
import { move } from './move.system.ts'
import { Square } from './square.component.ts'

/** The square's part of the sim: what it holds, what it hears and what runs each tick. */
export const squarePlugin = definePlugin({ name: 'story', defs: [Square, Hero, Move, move] })
