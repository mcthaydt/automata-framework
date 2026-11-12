// The `camera-yaw { units }` command on a real sim: a free, analogue turn (a right stick, a drag) that a game opts into in
// place of `camera-turn`'s 45° steps. The tick's commands add up and the heading turns by the sum, at most one
// `MAX_CAMERA_TURN` a tick, wrapping at 65,536; a view with `rotate: false` ignores it; a payload that is not an integer
// is rejected. The heading is sim state (the stick walks the player relative to it), so the same commands give the same
// hash on every run.
import { type Command, createSim, type Sim } from '@automata/sim'
import { afterEach, describe, expect, it } from 'vitest'
import { CameraHeading } from '#src/features/camera/sim/camera-heading.component.ts'
import { cameraHeadingPlugin } from '#src/features/camera/sim/camera-heading.plugin.ts'
import { CameraYaw } from '#src/features/camera/sim/camera-yaw.command.ts'
import { cameraYawPlugin } from '#src/features/camera/sim/camera-yaw.plugin.ts'
import { MAX_CAMERA_TURN, TURN_UNITS } from '#src/features/camera/sim/heading.ts'

const sims: Sim[] = []
afterEach(() => {
  for (const sim of sims.splice(0)) sim.dispose()
})

async function start(heading: number, rotate = true): Promise<{ sim: Sim; player: number }> {
  const sim = await createSim({ seed: 1, plugins: [cameraHeadingPlugin, cameraYawPlugin] })
  sims.push(sim)
  const player = sim.spawn([[CameraHeading, { view: 'hall', heading, rotate }]])
  return { sim, player }
}

let seq = 0
const yaw = (s: Sim, units: unknown): Command => ({
  tick: s.tick,
  source: 0,
  seq: seq++,
  type: CameraYaw.id,
  payload: { units },
})
const headingOf = (s: Sim, sid: number): number => s.entity(sid)?.get(CameraHeading).heading ?? -1

describe('camera-yaw', () => {
  it('is opt-in: camera-heading alone does not register it, so a game without it keeps its schema and its hashes', async () => {
    const plain = await createSim({ seed: 1, plugins: [cameraHeadingPlugin] })
    sims.push(plain)
    const player = plain.spawn([[CameraHeading, { view: 'hall', heading: 0, rotate: true }]])
    const result = plain.step([yaw(plain, 455)])
    expect(result.rejected).toHaveLength(1)
    expect(headingOf(plain, player)).toBe(0)
  })

  it('turns by its units, not by a 45° step, and keeps turning while it is held', async () => {
    const { sim, player } = await start(0)
    sim.step([yaw(sim, 455)])
    expect(headingOf(sim, player)).toBe(455)
    for (let tick = 0; tick < 9; tick++) sim.step([yaw(sim, 455)])
    expect(headingOf(sim, player)).toBe(4_550)
    sim.step([])
    expect(headingOf(sim, player)).toBe(4_550)
  })

  it('adds a tick’s commands and wraps at 65,536 either way', async () => {
    const { sim, player } = await start(TURN_UNITS - 100)
    sim.step([yaw(sim, 150), yaw(sim, 50)])
    expect(headingOf(sim, player)).toBe(100)
    sim.step([yaw(sim, -300)])
    expect(headingOf(sim, player)).toBe(TURN_UNITS - 200)
  })

  it('turns at most one MAX_CAMERA_TURN (45°) a tick, however far the tick dragged', async () => {
    const { sim, player } = await start(0)
    sim.step([yaw(sim, 8_000), yaw(sim, 8_000)])
    expect(headingOf(sim, player)).toBe(MAX_CAMERA_TURN)
    sim.step([yaw(sim, -40_000)])
    expect(headingOf(sim, player)).toBe(0)
  })

  it('is ignored in a view with rotate: false', async () => {
    const { sim, player } = await start(300, false)
    sim.step([yaw(sim, 1_000)])
    expect(headingOf(sim, player)).toBe(300)
  })

  it('rejects a payload that is not an integer', async () => {
    const { sim, player } = await start(0)
    const result = sim.step([yaw(sim, 1.5), yaw(sim, '9'), yaw(sim, Number.NaN)])
    expect(result.rejected).toHaveLength(3)
    expect(headingOf(sim, player)).toBe(0)
  })

  it('gives the same heading and the same hash for the same commands, every run', async () => {
    const turns = [455, 455, -120, 0, 8_000, -3, 77, -455, 1, 0, 300]
    const run = async (): Promise<{ heading: number; hash: string }> => {
      const { sim, player } = await start(1_000)
      for (const units of turns) sim.step([yaw(sim, units)])
      return { heading: headingOf(sim, player), hash: String(sim.hash()) }
    }
    const first = await run()
    const second = await run()
    expect(first.heading).toBe(9_710)
    expect(second).toEqual(first)
    // A different turn is a different state, so the hash sees the heading.
    const { sim } = await start(1_000)
    for (const units of [...turns.slice(0, -1), 301]) sim.step([yaw(sim, units)])
    expect(String(sim.hash())).not.toBe(first.hash)
  })
})
