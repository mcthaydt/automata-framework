import { definePlugin } from '@automata/sim'
import { Hero } from '../../shared/hero.component.ts'
import { Square } from '../../shared/square.component.ts'
import { Move } from './move.command.ts'
import { move } from './move.system.ts'

/** The square's part of the sim: what it holds, what it hears and what runs each tick. */
export const squarePlugin = definePlugin({ name: 'story', defs: [Square, Hero, Move, move] })
