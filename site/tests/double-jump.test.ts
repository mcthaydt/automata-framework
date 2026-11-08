import { afterEach, describe, expect, it } from 'vitest'
import { createBaseSim, moveCommand, readPlayer } from '../../automata-framework/games/emberwick/src/base-sim'
import { parseRoom, type RoomSource } from '../../automata-framework/games/emberwick/src/content/room'
import type { Sim } from '../../automata-framework/packages/sim/src/index'
import { base2dPlugin, Player, PlayerControl } from '../../automata-framework/games/emberwick/src/sim/index'
import { createRecorder, createReplayStepper } from '../../automata-framework/packages/sim/src/replay/index'
import { doubleJumpPlugin } from '../workshop/double-jump.plugin'

const room: RoomSource = {
  id: 'jump-test', tileSize: 8,
  rows: ['####################', ...Array.from({ length: 20 }, () => '#..................#'), '#..P............G..#', '####################'],
}
const live: Sim[] = []
afterEach(() => { for (const sim of live.splice(0)) sim.dispose() })
async function make(enhanced = true, source = room) {
  const sim = await createBaseSim({ seed: 7, room: source, plugins: enhanced ? [doubleJumpPlugin] : [] })
  live.push(sim)
  return sim
}
function drive(sim: Sim, jump: boolean, ticks = 1) {
  return Array.from({ length: ticks }, () => sim.step([moveCommand(sim, { x: 0, jump })])).flatMap(result => result.events)
}
function jumpTwice(sim: Sim) {
  drive(sim, false)
  const events = drive(sim, true, 8)
  events.push(...drive(sim, false, 8), ...drive(sim, true, 8))
  return events.filter(event => event.type === 'player.jumped')
}

describe('Playable first change: double jump', () => {
  it('keeps the original movement unchanged when no air jump is requested', async () => {
    const original = await make(false)
    const changed = await make()
    for (let tick = 0; tick < 90; tick++) {
      drive(original, tick > 0 && tick < 9)
      drive(changed, tick > 0 && tick < 9)
      expect(readPlayer(changed)).toEqual(readPlayer(original))
    }
  })
  it('adds a second jump on a fresh press while airborne', async () => {
    expect(jumpTwice(await make())).toHaveLength(2)
    expect(jumpTwice(await make(false))).toHaveLength(1)
  })
  it('does not spend extra jumps while the button is held', async () => {
    const sim = await make()
    drive(sim, false)
    expect(drive(sim, true, 35).filter(event => event.type === 'player.jumped')).toHaveLength(1)
  })
  it('refuses a third jump before landing', async () => {
    const sim = await make()
    const events = jumpTwice(sim)
    drive(sim, false, 2)
    events.push(...drive(sim, true).filter(event => event.type === 'player.jumped'))
    expect(events).toHaveLength(2)
  })
  it('restores the extra jump after landing', async () => {
    const sim = await make()
    expect(jumpTwice(sim)).toHaveLength(2)
    drive(sim, false, 120)
    expect(readPlayer(sim).grounded).toBe(true)
    expect(jumpTwice(sim)).toHaveLength(2)
  })
  it('reaches higher than the original with the same input', async () => {
    const original = await make(false)
    const changed = await make()
    let originalApex = readPlayer(original).y
    let changedApex = readPlayer(changed).y
    for (let tick = 0; tick < 90; tick++) {
      const jump = (tick >= 1 && tick <= 8) || (tick >= 17 && tick <= 25)
      drive(original, jump)
      drive(changed, jump)
      originalApex = Math.min(originalApex, readPlayer(original).y)
      changedApex = Math.min(changedApex, readPlayer(changed).y)
    }
    expect(changedApex).toBeLessThan(originalApex - 8 * 256)
  })
  it('restores jump availability and repeats the same run after a snapshot', async () => {
    const sim = await make()
    drive(sim, false)
    drive(sim, true, 8)
    drive(sim, false, 8)
    const checkpoint = sim.snapshot()
    expect(drive(sim, true).filter(event => event.type === 'player.jumped')).toHaveLength(1)
    const hash = sim.hash()
    sim.restore(checkpoint)
    expect(drive(sim, true).filter(event => event.type === 'player.jumped')).toHaveLength(1)
    expect(sim.hash()).toBe(hash)
  })
  it('keeps the extra jump after using the original coyote-time jump', async () => {
    const ledge: RoomSource = { id: 'ledge', tileSize: 8, rows: [
      '############', '#..........#', '#..........#', '#P.........#',
      '####.......#', '#..........#', '#..........#', '#.........G#', '############',
    ] }
    const sim = await make(true, ledge)
    drive(sim, false)
    for (let tick = 0; tick < 90 && readPlayer(sim).grounded; tick++) sim.step([moveCommand(sim, { x: 1, jump: false })])
    expect(readPlayer(sim).grounded).toBe(false)
    expect(drive(sim, true).filter(event => event.type === 'player.jumped')).toHaveLength(1)
    drive(sim, false)
    expect(drive(sim, true).filter(event => event.type === 'player.jumped')).toHaveLength(1)
  })
  it('stores jump availability independently for each player', async () => {
    const sim = await make()
    sim.spawn([[Player, { ...readPlayer(sim), x: readPlayer(sim).x + 8 * 256 }], PlayerControl])
    expect(jumpTwice(sim)).toHaveLength(4)
  })
  it('replays a double-jump run with matching checkpoint hashes', async () => {
    const sim = await make()
    const recorder = createRecorder(sim, { checkEvery: 10 })
    for (let tick = 0; tick < 90; tick++) {
      const jump = (tick >= 1 && tick <= 8) || (tick >= 17 && tick <= 25)
      recorder.step([moveCommand(sim, { x: 0, jump })])
    }
    const playback = await createReplayStepper(recorder.finish(), {
      plugins: [base2dPlugin, doubleJumpPlugin], content: { room: parseRoom(room) },
    })
    try { expect(playback.run()).toEqual({ ok: true, checks: 9 }) }
    finally { playback.dispose() }
  })
})
