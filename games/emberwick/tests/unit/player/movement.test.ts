import type { Sim, SimEvent } from '@automataframework/automata-sim'
import { afterEach, describe, expect, it } from 'vitest'
import { createBaseSim, moveCommand, readPlayer } from '#src/app/base-sim.ts'
import { Progress } from '#src/features/goal/progress.resource.ts'
import type { MoveInput } from '#src/features/player/move.command.ts'
import { Player } from '#src/shared/player.component.ts'
import { parseRoom, type RoomSource } from '#src/shared/room.ts'
import { HITBOX_H, HITBOX_W, SUB } from '#src/shared/tuning.ts'
import { ROOM } from '../../../fixtures/hand-written-room.ts'
import { HAND_WRITTEN_TUNING, JUMP_SPEED, MAX_FALL, MAX_RUN } from '../../../fixtures/hand-written-tuning.ts'

// Rooms small enough to read. `P` stands on the tile below it.
const room = (rows: string[]): RoomSource => ({ id: 'test', tileSize: 8, rows })
const CORRIDOR = room(['##########', '#........#', '#........#', '#P......G#', '##########'])
const LEDGE = room([
  '############',
  '#..........#',
  '#..........#',
  '#P.........#',
  '####.......#',
  '#..........#',
  '#..........#',
  '#.........G#',
  '############',
])
const HIGH_START = room([
  '##########',
  '#........#',
  '#P.......#',
  '#........#',
  '#........#',
  '#........#',
  '#........#',
  '#........#',
  '#.......G#',
  '##########',
])
const OPEN = room([
  '##########',
  ...Array.from({ length: 10 }, () => '#........#'),
  '#P......G#',
  '##########',
])
const LOW_CEILING = room([
  '##########',
  '#........#',
  '#........#',
  '#.####...#',
  '#........#',
  '#........#',
  '#.P.....G#',
  '##########',
])

const NONE: MoveInput = { x: 0, jump: false }
const RIGHT: MoveInput = { x: 1, jump: false }
const JUMP: MoveInput = { x: 0, jump: true }

/** Steps the sim once per input, collecting every event with the tick it happened on. */
function drive(sim: Sim, inputs: readonly MoveInput[]): Array<SimEvent & { tick: number }> {
  const events: Array<SimEvent & { tick: number }> = []
  for (const input of inputs) {
    const result = sim.step([moveCommand(sim, input)])
    expect(result.rejected).toEqual([])
    for (const event of result.events) events.push({ ...event, tick: result.tick })
  }
  return events
}

// Koota allows 16 worlds at once, so every test's sims are disposed after it.
const live: Sim[] = []
afterEach(() => {
  for (const sim of live.splice(0)) sim.dispose()
})
async function make(options: Omit<Parameters<typeof createBaseSim>[0], 'tuning'>): Promise<Sim> {
  const sim = await createBaseSim({ ...options, tuning: HAND_WRITTEN_TUNING })
  live.push(sim)
  return sim
}

const repeat = (input: MoveInput, ticks: number): MoveInput[] => Array.from({ length: ticks }, () => input)
const pixel = (subpixels: number) => Math.floor(subpixels / SUB)

/** No tile the hitbox covers is solid. */
function overlapsSolid(sim: Sim, source: RoomSource): boolean {
  const parsed = parseRoom(source)
  const p = readPlayer(sim)
  const left = pixel(p.x)
  const top = pixel(p.y)
  for (let y = top; y < top + HITBOX_H; y++)
    for (let x = left; x < left + HITBOX_W; x++)
      if (parsed.rows[Math.floor(y / 8)]?.charAt(Math.floor(x / 8)) === '#') return true
  return false
}

describe('the character on the ground', () => {
  it('starts at P, standing on the floor', async () => {
    const sim = await make({ room: CORRIDOR })
    drive(sim, [NONE])
    const p = readPlayer(sim)
    expect(pixel(p.x)).toBe(8)
    expect(pixel(p.y) + HITBOX_H).toBe(32) // feet on top of row 4
    expect(p.grounded).toBe(true)
    expect(p.vy).toBe(0)
    expect(sim.query(Player)).toHaveLength(1)
  })

  it('accelerates to max run speed and no further', async () => {
    const sim = await make({ room: ROOM })
    drive(sim, repeat(RIGHT, 30))
    expect(readPlayer(sim).vx).toBe(MAX_RUN)
    expect(readPlayer(sim).facing).toBe(1)
  })

  it('slows to a stop when the input is released', async () => {
    const sim = await make({ room: ROOM })
    drive(sim, repeat(RIGHT, 30))
    drive(sim, repeat(NONE, 30))
    const stopped = readPlayer(sim)
    expect(stopped.vx).toBe(0)
    drive(sim, repeat(NONE, 5))
    expect(readPlayer(sim).x).toBe(stopped.x)
  })

  it('faces left after moving left', async () => {
    const sim = await make({ room: ROOM })
    drive(sim, repeat({ x: -1, jump: false }, 3))
    expect(readPlayer(sim).facing).toBe(-1)
  })

  it('stops flush against a wall and never overlaps it', async () => {
    const tight = room(['######', '#...##', '#P.G##', '######'])
    const sim = await make({ room: tight })
    for (let tick = 0; tick < 60; tick++) {
      drive(sim, [RIGHT])
      expect(overlapsSolid(sim, tight)).toBe(false)
    }
    const p = readPlayer(sim)
    expect(pixel(p.x) + HITBOX_W).toBe(32) // the wall starts at column 4, pixel 32
    expect(p.vx).toBe(0)
  })
})

describe('falling and jumping', () => {
  it('falls, capped at max fall speed, and lands once', async () => {
    const sim = await make({ room: HIGH_START })
    const events = drive(sim, repeat(NONE, 90))
    const landings = events.filter((event) => event.type === 'player.landed')
    expect(landings).toHaveLength(1)
    const p = readPlayer(sim)
    expect(p.grounded).toBe(true)
    expect(pixel(p.y) + HITBOX_H).toBe(72) // the floor is row 9
  })

  it('never falls faster than max fall', async () => {
    const sim = await make({
      room: room(['####', '#..#', '#P.#', ...Array.from({ length: 40 }, () => '#..#'), '#.G#', '####']),
    })
    for (let tick = 0; tick < 60; tick++) {
      drive(sim, [NONE])
      expect(readPlayer(sim).vy).toBeLessThanOrEqual(MAX_FALL)
    }
    expect(readPlayer(sim).vy).toBe(MAX_FALL)
  })

  it('jumps from the floor', async () => {
    const sim = await make({ room: CORRIDOR })
    drive(sim, [NONE])
    const before = readPlayer(sim)
    const events = drive(sim, [JUMP])
    expect(events.map((event) => event.type)).toEqual(['player.jumped'])
    expect(readPlayer(sim).vy).toBe(JUMP_SPEED)
    expect(readPlayer(sim).y).toBeLessThan(before.y)
    expect(readPlayer(sim).grounded).toBe(false)
  })

  it('jumps higher while jump is held than when it is tapped', async () => {
    const apex = async (held: number) => {
      const sim = await make({ room: OPEN })
      drive(sim, [NONE])
      let highest = readPlayer(sim).y
      for (let tick = 0; tick < 60; tick++) {
        drive(sim, [tick < held ? JUMP : NONE])
        highest = Math.min(highest, readPlayer(sim).y)
      }
      return readPlayer(sim).y - highest
    }
    const tapped = await apex(1)
    const held = await apex(30)
    expect(held).toBeGreaterThan(tapped * 2)
    // A held jump clears three tiles (the room's platform step), a tap does not.
    expect(pixel(held)).toBeGreaterThanOrEqual(24)
    expect(pixel(tapped)).toBeLessThan(24)
  })

  it('cannot jump again in mid-air', async () => {
    const sim = await make({ room: OPEN })
    drive(sim, [NONE])
    const events = drive(sim, [JUMP, NONE, NONE, JUMP, NONE, JUMP])
    expect(events.filter((event) => event.type === 'player.jumped')).toHaveLength(1)
  })

  it('remembers a jump pressed just before landing (jump buffer)', async () => {
    const landingTick = async () => {
      const sim = await make({ room: HIGH_START })
      const events = drive(sim, repeat(NONE, 90))
      return events.find((event) => event.type === 'player.landed')?.tick ?? -1
    }
    const landsAt = await landingTick()
    const jumpPressedAt = async (tick: number) => {
      const sim = await make({ room: HIGH_START })
      // Ticks are counted from 1 (the tick a step ends on); press on one tick, then let go.
      const inputs = Array.from({ length: 90 }, (_, i) => (i + 1 === tick ? JUMP : NONE))
      return drive(sim, inputs).filter((event) => event.type === 'player.jumped')
    }
    // The landing happens during the move at the end of a tick, so the buffered jump fires on the next one.
    const buffered = await jumpPressedAt(landsAt - 3)
    expect(buffered.map((event) => event.tick)).toEqual([landsAt + 1])
    expect(await jumpPressedAt(landsAt - 8)).toEqual([])
  })

  it('still jumps just after walking off a ledge (coyote time), but not later', async () => {
    const leftGroundAt = async () => {
      const sim = await make({ room: LEDGE })
      for (let tick = 1; tick < 120; tick++) {
        drive(sim, [RIGHT])
        if (!readPlayer(sim).grounded) return tick
      }
      return -1
    }
    const offAt = await leftGroundAt()
    expect(offAt).toBeGreaterThan(0)
    const jumpAt = async (tick: number) => {
      const sim = await make({ room: LEDGE })
      const inputs = Array.from({ length: tick + 2 }, (_, i) => ({ x: 1, jump: i + 1 === tick }) as const)
      return drive(sim, inputs).filter((event) => event.type === 'player.jumped')
    }
    expect(await jumpAt(offAt + 4)).toHaveLength(1)
    expect(await jumpAt(offAt + 8)).toHaveLength(0)
  })

  it('stops rising when its head hits a ceiling', async () => {
    const sim = await make({ room: LOW_CEILING })
    drive(sim, [NONE])
    for (let tick = 0; tick < 20; tick++) {
      drive(sim, [JUMP])
      expect(overlapsSolid(sim, LOW_CEILING)).toBe(false)
    }
    // Head against the underside of row 3 (pixel 32), then falling again.
    expect(pixel(readPlayer(sim).y)).toBeGreaterThanOrEqual(32)
    drive(sim, repeat(NONE, 40))
    expect(readPlayer(sim).grounded).toBe(true)
  })
})

describe('the goal', () => {
  it('fires once when the character touches the goal', async () => {
    const sim = await make({ room: CORRIDOR })
    const events = drive(sim, repeat(RIGHT, 120))
    const reached = events.filter((event) => event.type === 'goal.reached')
    expect(reached).toHaveLength(1)
    expect(sim.resource(Progress).reached).toBe(true)
  })

  it('has not fired at the start', async () => {
    const sim = await make({ room: CORRIDOR })
    drive(sim, [NONE])
    expect(sim.resource(Progress).reached).toBe(false)
  })
})
