// The adventure source's puzzle-engine toy room, ported as a behavior spec: a locked door, a key in a drawer and a lamp
// that needs its two halves. `createToy` runs it in a real sim through `verb` commands.
import {
  createSim,
  defineCommand,
  definePlugin,
  defineSystem,
  type Sim,
  type StepResult,
} from '@automata/sim'
import { z } from 'zod'
import { createPuzzlePlugin, loadPuzzle, type PuzzleDef, type PuzzleOptions } from '../sim/index'

export const TOY: PuzzleDef = {
  scene: 'toy',
  facts: { drawer: 0, doorOpen: false },
  items: ['key', 'shade', 'bulb', 'lamp'],
  hotspots: { door: { x: 1, z: 2 }, drawer: { x: 1, z: 2 } },
  entry: [{ name: 'start', items: [] }],
  actions: [
    {
      id: 'drawer.key',
      at: 'drawer',
      when: [{ fact: 'drawer', is: 0 }],
      then: [{ set: 'drawer', to: 1 }, { give: 'key' }],
      say: 'drawerKey',
    },
    {
      id: 'drawer.parts',
      at: 'drawer',
      when: [
        { fact: 'drawer', atLeast: 1 },
        { fact: 'drawer', atMost: 1 },
      ],
      then: [{ add: 'drawer', by: 1 }, { give: 'shade' }, { give: 'bulb' }],
      say: 'drawerParts',
    },
    { id: 'door.open', at: 'door', when: [{ fact: 'doorOpen', is: true }], then: [], say: 'doorOpen' },
    {
      id: 'door.unlock',
      at: 'door',
      use: 'key',
      then: [{ set: 'doorOpen', to: true }, { take: 'key' }, { checkpoint: true }],
      say: 'doorUnlock',
    },
    {
      id: 'door.bare',
      at: 'door',
      when: [{ fact: 'held', is: '' }, { has: 'key' }],
      then: [{ set: 'doorOpen', to: true }, { take: 'key' }],
      say: 'doorUnlock',
    },
    {
      id: 'door.knock',
      at: 'door',
      when: [{ not: { any: [{ has: 'key' }, { fact: 'held', is: 'shade' }] } }],
      then: [{ noise: { at: 'door', loudness: 4, kind: 'bang' } }],
      say: 'knock',
    },
    {
      id: 'lamp',
      at: 'combine',
      use: ['shade', 'bulb'],
      then: [{ take: 'shade' }, { take: 'bulb' }, { give: 'lamp' }, { call: 'glow' }],
      say: 'lampMade',
    },
    {
      id: 'code',
      at: 'code',
      when: [{ fact: 'code', is: '42' }],
      then: [{ set: 'doorOpen', to: true }],
      say: 'codeRight',
    },
  ],
  systemic: [],
  lethal: [],
  goal: [{ fact: 'doorOpen', is: true }],
  fallback: { '*': 'nothing', combine: 'noCombine', floor: 'noFloor' },
}

const Load = defineCommand('scene.load', z.object({ scene: z.string(), entry: z.string().optional() }))

/** A test game: `scene.load` makes a named def the scene's puzzle, as a game's Flow does on a scene change. */
const scenes = (defs: Readonly<Record<string, PuzzleDef>>) =>
  definePlugin({
    name: 'scenes',
    dependsOn: ['puzzle'],
    commands: [Load],
    systems: [
      defineSystem({
        name: 'scenes.load',
        phase: 'input',
        run: (ctx) => {
          for (const { payload } of ctx.commands.of(Load))
            loadPuzzle(ctx, defs[payload.scene] as PuzzleDef, payload.entry)
        },
      }),
    ],
  })

/** A sim with the puzzle plugin and the toy room loaded (one step). */
export async function createToy(
  options: PuzzleOptions = {},
  defs: Readonly<Record<string, PuzzleDef>> = { toy: TOY },
): Promise<Sim> {
  const sim = await createSim({ seed: 7, plugins: [createPuzzlePlugin(options), scenes(defs)] })
  loadScene(sim, Object.keys(defs)[0] as string)
  return sim
}

export const loadScene = (sim: Sim, scene: string, entry?: string): StepResult =>
  sim.step([
    {
      tick: sim.tick,
      source: 0,
      seq: 0,
      type: 'scene.load',
      payload: entry === undefined ? { scene } : { scene, entry },
    },
  ])

export interface VerbPayload {
  readonly at: string
  readonly held?: string
  readonly pair?: readonly [string, string]
  readonly code?: string
  readonly point?: { readonly x: number; readonly z: number }
}

/** Steps `sim` once with one `puzzle.verb` command. */
export const verb = (sim: Sim, payload: VerbPayload): StepResult =>
  sim.step([{ tick: sim.tick, source: 0, seq: 0, type: 'puzzle.verb', payload }])

/** The events of a step as `type payload` pairs, for readable expectations. */
export const said = (result: StepResult): unknown[] => result.events.map((e) => [e.type, e.payload])
