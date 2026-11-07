// Cutscenes wired into puzzle (M6.9a step 4): a `{ cutscene }` effect starts the script through puzzle's `cutscene` hook,
// and while it plays puzzle's verbs are ignored through its `locked` option.
import { createPuzzlePlugin, loadPuzzle, type PuzzleDef } from '@automata/puzzle/sim'
import { createSim, defineCommand, definePlugin, defineSystem } from '@automata/sim'
import { expect, it } from 'vitest'
import { z } from 'zod'
import { type CutsceneScript, createCutscenes } from './index'
import { heard, skip, step } from './testing/cut-game'

const DEF: PuzzleDef = {
  scene: 'toy',
  facts: { opened: false, looked: 0 },
  items: [],
  hotspots: { door: { x: 0, z: 0 }, drawer: { x: 1, z: 1 } },
  entry: [{ name: 'start', items: [] }],
  actions: [
    { id: 'door.open', at: 'door', then: [{ set: 'opened', to: true }, { cutscene: 'dawn' }], say: 'door' },
    { id: 'drawer.look', at: 'drawer', then: [{ add: 'looked', by: 1 }], say: 'drawer' },
  ],
  systemic: [],
  lethal: [],
  goal: [{ fact: 'opened', is: true }],
  fallback: { '*': 'nothing' },
}
const DAWN: CutsceneScript = {
  id: 'dawn',
  duration: 1,
  camera: [{ t: 0, pos: [0, 1.6, 4], look: [0, 1.2, 0] }],
}
const Load = defineCommand('toy.load', z.strictObject({}))

async function game() {
  const cutscenes = createCutscenes()
  const plugin = definePlugin({
    name: 'toy',
    dependsOn: ['puzzle', 'cutscenes'],
    commands: [Load],
    systems: [
      defineSystem('toy.load', 'input', (ctx) => {
        for (const _ of ctx.commands.of(Load)) {
          loadPuzzle(ctx, DEF)
          cutscenes.load(ctx, [DAWN])
        }
      }),
    ],
  })
  const sim = await createSim({
    seed: 3,
    plugins: [
      createPuzzlePlugin({ cutscene: cutscenes.start, locked: cutscenes.locked }),
      cutscenes.plugin,
      plugin,
    ],
  })
  step(sim, { type: 'toy.load', payload: {} })
  return sim
}
const verb = (at: string) => ({ type: 'puzzle.verb', payload: { at } })
const lines = (r: { events: readonly { type: string; payload: unknown }[] }) =>
  r.events.filter((e) => e.type === 'puzzle.said').map((e) => (e.payload as { line: string }).line)

it('starts the cutscene from the effect, ignores verbs while it plays, and takes them after it ends', async () => {
  const sim = await game()
  const opened = step(sim, verb('door'))
  expect(heard(opened).map(([type]) => type)).toEqual(['cutscene.started'])
  expect(lines(step(sim, verb('drawer')))).toEqual([])
  let ended = false
  for (let i = 0; i < 80 && !ended; i++) ended = heard(step(sim)).some(([type]) => type === 'cutscene.ended')
  expect(ended).toBe(true)
  expect(lines(step(sim, verb('drawer')))).toEqual(['drawer'])
})

it('takes verbs again as soon as the cutscene is skipped', async () => {
  const sim = await game()
  step(sim, verb('door'))
  expect(heard(step(sim, skip())).map(([type]) => type)).toEqual(['cutscene.ended'])
  expect(lines(step(sim, verb('drawer')))).toEqual(['drawer'])
})
