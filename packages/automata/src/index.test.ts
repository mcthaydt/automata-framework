import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import * as game from '@mcthaydt/automata-game'
import * as sim from '@mcthaydt/automata-sim'
import { describe, expect, it } from 'vitest'
import * as automata from './index.ts'

// `@mcthaydt/automata`, the one import (PRODUCT spec §7, plan U-2): the game package and the sim's define verbs,
// each the very same value as its owner's. The list is pinned, so a new verb is added on purpose (`defineSave`, M5.2:
// `defineGame({ saves })` takes a save, and a game imports the umbrella, not the runtime, to declare one).
const FROM_GAME = [
  'GameSpecError',
  'createCamera2d',
  'defaultContent',
  'defaultScreens',
  'defineGame',
  'defineSave',
  'keys',
  'postFilter',
  'rect',
  'sprite',
  'startGame',
] as const
const FROM_SIM = [
  'defineCommand',
  'defineComponent',
  'defineEvent',
  'definePlugin',
  'defineResource',
  'defineSystem',
] as const

const umbrella = new Map(Object.entries(automata))
const gameExports = new Map(Object.entries(game))
const simExports = new Map(Object.entries(sim))

describe('@mcthaydt/automata', () => {
  it('exports exactly the pinned verbs', () => {
    expect(Object.keys(automata).sort()).toEqual([...FROM_GAME, ...FROM_SIM].sort())
  })

  it('re-exports everything the game package exports', () => {
    expect(Object.keys(game).sort()).toEqual([...FROM_GAME])
  })

  it.each(FROM_GAME)('%s is the game package’s own', (name) => {
    expect(umbrella.get(name)).toBe(gameExports.get(name))
  })

  it.each(FROM_SIM)('%s is the sim’s own', (name) => {
    expect(umbrella.get(name)).toBe(simExports.get(name))
  })

  it('has a no-eval entry that loads', async () => {
    await expect(import('./no-eval.ts')).resolves.toBeDefined()
  })

  it('depends on core only, never on a Plus extension (plan U-4)', () => {
    const manifest = JSON.parse(readFileSync(join(import.meta.dirname, '..', 'package.json'), 'utf8')) as {
      dependencies: Record<string, string>
    }
    expect(Object.keys(manifest.dependencies).sort()).toEqual([
      '@mcthaydt/automata-game',
      '@mcthaydt/automata-sim',
    ])
  })
})
