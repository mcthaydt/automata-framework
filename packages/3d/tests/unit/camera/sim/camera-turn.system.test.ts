// The `camera-turn { units }` command on a real sim (D3-i): the tick's commands add up, their sign turns one 45° step and it wraps at
// 65,536 on every entity with `camera-heading`; a view with `rotate: false` ignores them; a payload that is not an
// integer is rejected, so a replay stores integers only.
import { type Command, createSim, type Sim } from '@automataframework/sim'
import { afterEach, describe, expect, it } from 'vitest'
import { CameraHeading } from '#src/features/camera/sim/camera-heading.component.ts'
import { cameraHeadingPlugin } from '#src/features/camera/sim/camera-heading.plugin.ts'
import { CameraTurn } from '#src/features/camera/sim/camera-turn.command.ts'
import { TURN_UNITS } from '#src/features/camera/sim/heading.ts'

let sim: Sim | undefined
afterEach(() => {
  sim?.dispose()
  sim = undefined
})

async function start(heading: number, rotate = true): Promise<{ sim: Sim; player: number }> {
  sim = await createSim({ seed: 1, plugins: [cameraHeadingPlugin] })
  const player = sim.spawn([[CameraHeading, { view: 'hall', heading, rotate }]])
  return { sim, player }
}

let seq = 0
const turn = (s: Sim, units: unknown): Command => ({
  tick: s.tick,
  source: 0,
  seq: seq++,
  type: CameraTurn.id,
  payload: { units },
})
const headingOf = (s: Sim, sid: number): number => s.entity(sid)?.get(CameraHeading).heading ?? -1

describe('camera-turn', () => {
  it('turns one 45° step toward the sign of the turn, wrapping at 65,536', async () => {
    const { sim, player } = await start(TURN_UNITS - 8_192)
    sim.step([turn(sim, 25)])
    expect(headingOf(sim, player)).toBe(0)
    sim.step([])
    sim.step([turn(sim, -16)])
    expect(headingOf(sim, player)).toBe(TURN_UNITS - 8_192)
  })

  it('adds a tick’s commands, then turns one step by the sum’s sign', async () => {
    const { sim, player } = await start(0)
    sim.step([turn(sim, 5_000), turn(sim, 5_000)])
    expect(headingOf(sim, player)).toBe(8_192)
    sim.step([])
    sim.step([turn(sim, 3), turn(sim, -1)])
    expect(headingOf(sim, player)).toBe(16_384)
    sim.step([])
    sim.step([turn(sim, 3), turn(sim, -3)])
    expect(headingOf(sim, player)).toBe(16_384)
  })

  it('steps once per press: a key held for many ticks is one step, and a tick with no command lets go', async () => {
    const { sim, player } = await start(0)
    for (let tick = 0; tick < 30; tick++) sim.step([turn(sim, 364)])
    expect(headingOf(sim, player)).toBe(8_192)
    sim.step([])
    for (let tick = 0; tick < 30; tick++) sim.step([turn(sim, 364)])
    expect(headingOf(sim, player)).toBe(16_384)
    sim.step([turn(sim, 0)])
    sim.step([turn(sim, -364)])
    expect(headingOf(sim, player)).toBe(8_192)
  })

  it('is ignored in a view with rotate: false', async () => {
    const { sim, player } = await start(300, false)
    sim.step([turn(sim, 1_000)])
    expect(headingOf(sim, player)).toBe(300)
  })

  it('rejects a payload that is not an integer', async () => {
    const { sim, player } = await start(0)
    const result = sim.step([turn(sim, 1.5), turn(sim, '9'), turn(sim, 40_000.25)])
    expect(result.rejected).toHaveLength(3)
    expect(headingOf(sim, player)).toBe(0)
  })

  it('puts view and heading in the render rows', async () => {
    const { sim, player } = await start(0)
    const result = sim.step([turn(sim, 7)])
    const row = [...result.render.added, ...result.render.changed].find((r) => r.sid === player)
    expect(row?.components[CameraHeading.id]).toMatchObject({ view: 'hall', heading: 8_192 })
  })
})
