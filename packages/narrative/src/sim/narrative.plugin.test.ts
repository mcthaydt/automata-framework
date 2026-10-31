// The narrative plugin (M6 spec §4.7, §4.13): conversations through commands, puzzle's `{ dialogue }` effect, the
// storylets on verbs, rooms, standing still and system events, and a restore mid-conversation.
import type { Sim } from '@mcthaydt/automata-sim'
import { afterEach, describe, expect, it } from 'vitest'
import {
  advance,
  choose,
  createTalkGame,
  fact,
  heard,
  load,
  move,
  type Order,
  SPOTS,
  start,
  step,
  system,
  verb,
} from '../testing/talk-game'
import { TALK_PUZZLE, TALK_SCENE } from '../testing/talk-toy'
import { NarrativeDialogue, NarrativeStorylets } from './index'

let sim: Sim | undefined
afterEach(() => {
  sim?.dispose()
  sim = undefined
})
async function talk(): Promise<Sim> {
  sim = (await createTalkGame(TALK_PUZZLE, TALK_SCENE)).sim
  step(sim, load())
  return sim
}
/** Steps `n` times with no orders, gathering what was heard. */
const wait = (s: Sim, n: number): unknown[] => Array.from({ length: n }, () => heard(step(s))).flat()

describe('conversations', () => {
  it('starts, advances and chooses through commands, with every event’s payload', async () => {
    const s = await talk()
    expect(heard(step(s, start('meet')))).toEqual([['narrative.line', { graph: 'meet', id: 'toy.hello' }]])
    expect(heard(step(s, advance()))).toEqual([
      ['narrative.line', { graph: 'meet', id: 'toy.ask' }],
      [
        'narrative.choices',
        {
          graph: 'meet',
          choices: [
            { index: 0, line: 'toy.duty' },
            { index: 1, line: 'toy.unsure' },
            { index: 2, line: 'toy.yours' },
          ],
        },
      ],
    ])
    expect(heard(step(s, advance()))).toEqual([])
    expect(heard(step(s, choose(2)))).toEqual([['narrative.line', { graph: 'meet', id: 'toy.bye' }]])
    expect(s.resource(NarrativeDialogue)).toMatchObject({
      graph: 'meet',
      stance: 1,
      facts: { metPorter: true },
    })
    expect(heard(step(s, advance()))).toEqual([['narrative.ended', { graph: 'meet' }]])
    expect(s.resource(NarrativeDialogue)).toMatchObject({ graph: null, place: null, stance: 1 })
  })

  it('a choice gated shut is hidden, and a choice not on offer does nothing', async () => {
    const s = await talk()
    step(s, fact('light', 'lighter'), start('meet'))
    step(s, advance())
    expect(heard(step(s, choose(7)))).toEqual([])
    expect(heard(step(s, choose(0)))).toEqual([['narrative.line', { graph: 'meet', id: 'toy.warm' }]])
    expect(s.resource(NarrativeDialogue).stance).toBe(-1)
  })

  it('a `{ dialogue }` effect starts the graph on the verb’s step', async () => {
    const s = await talk()
    expect(heard(step(s, verb('phone')))).toEqual([
      ['puzzle.dialogue', { id: 'meet' }],
      ['narrative.line', { graph: 'meet', id: 'toy.hello' }],
    ])
  })
})

describe('storylets', () => {
  it('an inspect plays two seconds after the action’s own line', async () => {
    const s = await talk()
    expect(heard(step(s, verb('bed')))).toEqual([
      ['puzzle.said', { action: 'bed', at: 'bed', line: 'bed.own', gained: [] }],
    ])
    expect(wait(s, 118)).toEqual([])
    expect(wait(s, 2)).toEqual([['narrative.storylet', { id: 'st.bed', line: 'st.bed.1' }]])
    expect(s.resource(NarrativeStorylets).played).toEqual({ 'st.bed': 1 })
  })

  it('an entry into a zone plays, each time the next line, and a system event plays at once', async () => {
    const s = await talk()
    wait(s, 2)
    step(s, move(SPOTS.corridor))
    expect(wait(s, 2)).toEqual([['narrative.storylet', { id: 'st.corridor', line: 'st.corridor.1' }]])
    step(s, move(SPOTS.hall))
    step(s, move(SPOTS.corridor))
    expect(wait(s, 2)).toEqual([['narrative.storylet', { id: 'st.corridor', line: 'st.corridor.2' }]])
    expect(heard(step(s, system('light.on')))).toEqual([
      ['narrative.storylet', { id: 'st.lit', line: 'st.lit.1' }],
    ])
    expect(heard(step(s, system('light.on')))).toEqual([])
  })

  it('a dwell counts standing still and reads the conversation’s facts', async () => {
    const s = await talk()
    step(s, move(SPOTS.closet))
    expect(wait(s, 180)).toEqual([])
    step(s, start('meet'))
    step(s, advance())
    step(s, choose(2))
    step(s, advance())
    expect(wait(s, 121)).toEqual([['narrative.storylet', { id: 'st.closet', line: 'st.closet.1' }]])
  })
})

describe('restore', () => {
  it('a restore mid-conversation gives the same events and hash', async () => {
    const script: Order[][] = [
      [start('meet')],
      [advance()],
      [verb('bed')],
      [choose(2)],
      [move(SPOTS.corridor)],
      [],
      [advance()],
      [system('light.on')],
    ]
    const run = async (restoreAt?: number) => {
      let game = await createTalkGame(TALK_PUZZLE, TALK_SCENE)
      step(game.sim, load())
      const out: unknown[] = []
      for (const [i, orders] of script.entries()) {
        if (i === restoreAt) {
          const bytes = game.sim.snapshot()
          game.sim.dispose()
          game = await createTalkGame(TALK_PUZZLE, TALK_SCENE)
          game.sim.restore(bytes)
        }
        out.push(heard(step(game.sim, ...orders)))
      }
      out.push(wait(game.sim, 130))
      const hash = game.sim.hash()
      game.sim.dispose()
      return { out, hash }
    }
    const whole = await run()
    expect(await run(3)).toEqual(whole)
    expect(whole.out.flat(1)).toContainEqual(['narrative.storylet', { id: 'st.bed', line: 'st.bed.1' }])
  })
})
