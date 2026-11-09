import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import * as sim from '@automata/sim'
import { describe, expect, it } from 'vitest'
import * as game from '#src/entries/game.ts'
import * as automata from '#src/entries/game-and-sim.ts'

// `@automata/framework`, the one import (PRODUCT spec §7, plan U-2): the game package and the sim's define verbs,
// each the very same value as its owner's. The list is pinned, so a new verb is added on purpose (`defineSave`, M5.2:
// `defineGame({ saves })` takes a save, and a game imports the umbrella, not the runtime, to declare one; `inputs`,
// M3.7b: a game whose sim takes several commands joins its `keys()` maps; `controlsFrom`: the same map from a controls file; `mergeStageHooks`: an extension's stage hooks joined with the game's).
const FROM_GAME = [
  'GameSpecError',
  'controlsFrom',
  'createCamera2d',
  'defaultContent',
  'defaultScreens',
  'defineGame',
  'defineSave',
  'inputs',
  'keys',
  'levelScene',
  'mergeStageHooks',
  'pictureView',
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

describe('@automata/framework', () => {
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

  it('depends on core only, never on a Plus extension (plan U-4)', () => {
    const manifest = JSON.parse(
      readFileSync(join(import.meta.dirname, '../../..', 'package.json'), 'utf8'),
    ) as {
      dependencies: Record<string, string>
    }
    expect(Object.keys(manifest.dependencies).filter((name) => name.includes('plus'))).toEqual([])
  })
})
