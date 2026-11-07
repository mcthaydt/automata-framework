// Bots (M6 spec §4.6): the adventure source's `bots.test.ts` unit cases, re-pointed at AF. A bot answers what it sees
// with sim commands only, exactly as input does, and its choices come from its seed.
import { describe, expect, it } from 'vitest'
import { type BotView, createBot, type Order } from './index'

const PLAYER = 7
const view = (o: Partial<BotView> = {}): BotView => ({
  time: 0,
  dt: 1 / 60,
  player: { x: 0, z: 0 },
  walking: false,
  lit: false,
  agents: [],
  hotspots: { desk: { x: 0, z: 0.2 }, keypad: { x: 3, z: 0 }, door: { x: -4, z: 0 } },
  items: ['key'],
  ...o,
})
const light = (on: boolean): Order => ({ type: 'game.light', payload: { on } })

describe('bots', () => {
  it('answer with sim commands, as input does, and type the code at the keypad', () => {
    const bot = createBot('scripted', {
      player: PLAYER,
      seed: 1,
      plan: [
        { action: 'desk.key', at: 'desk', held: 'key' },
        { action: 'keypad', at: 'code' },
      ],
      keypad: 'keypad',
      codes: ['0417'],
    })
    // At the desk already: the verb, with the item held.
    expect(bot.next(view())).toEqual([{ type: 'puzzle.verb', payload: { at: 'desk', held: 'key' } }])
    // The keypad is 3 m away: a walk there first.
    expect(bot.next(view())).toEqual([
      { type: 'nav.walk-to', payload: { entity: PLAYER, to: { x: 3, z: 0 } } },
    ])
    // Walking: nothing.
    expect(bot.next(view({ walking: true, player: { x: 1.5, z: 0 } }))).toEqual([])
    // There: the code, typed.
    expect(bot.next(view({ player: { x: 3, z: 0 } }))).toEqual([
      { type: 'puzzle.verb', payload: { at: 'code', code: '0417' } },
    ])
    expect(bot.issued).toEqual(['desk:key', 'code:0417'])
    expect(bot.done()).toBe(true)
  })

  it('the scripted bot holds up its light near an awake agent; the cautious bot also stands still while hunted', () => {
    const near = [{ id: 'nurse', x: 2, z: 0, mode: 'patrol' }]
    const scripted = createBot('scripted', {
      player: PLAYER,
      seed: 1,
      plan: [{ action: 'door.open', at: 'door' }],
      light,
    })
    const first = scripted.next(view({ agents: near }))
    expect(first[0]).toEqual(light(true))
    expect(scripted.issued[0]).toBe('light')
    // Asleep (a resting mode) is no reason to hold it up; lit and nobody near, it goes out.
    const resting = createBot('scripted', {
      player: PLAYER,
      seed: 1,
      plan: [{ action: 'door.open', at: 'door' }],
      light,
      resting: ['asleep'],
    })
    expect(
      resting
        .next(view({ agents: [{ id: 'nurse', x: 2, z: 0, mode: 'asleep' }] }))
        .some((o) => o.type === 'game.light'),
    ).toBe(false)
    expect(scripted.next(view({ lit: true }))[0]).toEqual(light(false))
    // Hunted within 6 m while walking: the cautious bot stops where it stands.
    const cautious = createBot('cautious', {
      player: PLAYER,
      seed: 1,
      plan: [{ action: 'door.open', at: 'door' }],
    })
    const hunted = [{ id: 'nurse', x: 2, z: 0, mode: 'hunt' }]
    expect(cautious.next(view({ agents: hunted, walking: true, player: { x: -1, z: 0 } }))).toEqual([
      { type: 'nav.walk-to', payload: { entity: PLAYER, to: { x: -1, z: 0 } } },
    ])
    // With `evade`, it steps away from the hunter instead.
    const evading = createBot('cautious', {
      player: PLAYER,
      seed: 1,
      plan: [{ action: 'door.open', at: 'door' }],
      evade: true,
    })
    const away = evading.next(view({ agents: hunted }))[0] as Order & { payload: { to: { x: number } } }
    expect(away.type).toBe('nav.walk-to')
    expect(away.payload.to.x).toBeLessThan(0)
  })

  it("a bot's choices come from its seed, not the sim", () => {
    const play = (seed: number) => {
      const bot = createBot('random', { player: PLAYER, seed, combines: [['key', 'key']], codes: ['1234'] })
      for (let i = 0; i < 40; i++) bot.next(view({ time: i / 60 }))
      return bot.issued
    }
    expect(play(3)).toEqual(play(3))
    expect(play(3)).not.toEqual(play(4))
    expect(play(3).length).toBeGreaterThan(5)
  })

  it('the greedy bot skips waits, and with `explore` sometimes skips a step', () => {
    const plan = [
      { action: 'a', at: 'desk', wait: 5 },
      { action: 'b', at: 'desk' },
    ]
    const greedy = createBot('greedy', { player: PLAYER, seed: 1, plan })
    greedy.next(view())
    expect(greedy.next(view())).toEqual([{ type: 'puzzle.verb', payload: { at: 'desk' } }])
    const scripted = createBot('scripted', { player: PLAYER, seed: 1, plan })
    scripted.next(view())
    expect(scripted.next(view())).toEqual([])
    const explorer = (seed: number) => {
      const bot = createBot('greedy', {
        player: PLAYER,
        seed,
        plan: Array.from({ length: 20 }, (_, i) => ({ action: `s${i}`, at: 'desk' })),
        explore: { skip: 0.5, detour: 0 },
      })
      for (let i = 0; i < 40; i++) bot.next(view())
      return bot.issued.length
    }
    expect(explorer(2)).toBeLessThan(20)
  })

  it('restart tries the current step again', () => {
    const bot = createBot('scripted', { player: PLAYER, seed: 1, plan: [{ action: 'a', at: 'door' }] })
    expect(bot.next(view())[0]?.type).toBe('nav.walk-to')
    bot.restart()
    expect(bot.next(view())[0]?.type).toBe('nav.walk-to')
  })
})
