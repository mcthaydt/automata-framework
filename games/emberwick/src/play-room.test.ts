import type { Sim, StepResult } from '@mcthaydt/automata-sim'
import { describe, expect, it } from 'vitest'
import { ROOM } from '../fixtures/hand-written-room.ts'
import { HAND_WRITTEN_TUNING } from '../fixtures/hand-written-tuning.ts'
import { createBaseSim, readPlayer } from './base-sim.ts'
import type { Room, RoomSource } from './content/room.ts'
import type { Held } from './input/keys.ts'
import { STEP_MS } from './loop.ts'
import { createPlay, type PlaySeams } from './play-room.ts'
import type { Renderer, RendererLayer } from './render/renderer.ts'

/** What every play needs: the room and the tunables (the hand-written ones; the compiled ones are held equal in `content/level-room.test.ts`). */
const base = { room: ROOM, tuning: HAND_WRITTEN_TUNING }

/** A renderer that records what it was given instead of drawing. */
function fakeRenderer(room: Room) {
  const log = {
    room: room.id,
    applied: 0,
    draws: 0,
    resets: 0,
    destroyed: false,
    layers: [] as RendererLayer[],
  }
  const renderer: Renderer = {
    apply: () => {
      log.applied++
    },
    draw: () => {
      log.draws++
    },
    reset: () => {
      log.resets++
    },
    fitToHost: () => {},
    playerPixel: () => ({ x: 1, y: 2 }),
    addLayer: (layer) => {
      log.layers.push(layer)
      return () => log.layers.splice(log.layers.indexOf(layer), 1)
    },
    isLitByRoom: () => true,
    destroy: () => {
      log.destroyed = true
    },
  }
  return { renderer, log }
}

/** Seams driven by hand: `frame()` advances the clock by one sim step and runs the scheduled frame. */
function seams(held: Held = { left: false, right: true, jump: false }) {
  const renderers: Array<ReturnType<typeof fakeRenderer>['log']> = []
  let pending: (() => void) | null = null
  let time = 1000
  const play: PlaySeams = {
    createRenderer: async (room) => {
      const fake = fakeRenderer(room)
      renderers.push(fake.log)
      return fake.renderer
    },
    held: () => held,
    now: () => time,
    requestFrame: (fn) => {
      pending = fn
      return 1
    },
    cancelFrame: () => {
      pending = null
    },
  }
  return {
    play,
    renderers,
    frame() {
      time += STEP_MS
      const fn = pending
      pending = null
      fn?.()
    },
    get scheduled() {
      return pending !== null
    },
  }
}

const shifted: RoomSource = { ...ROOM, id: 'room-2' }

/** A `createSim` that keeps every sim it makes and notes which ones were disposed. */
function trackedSims() {
  const sims: Sim[] = []
  const disposed = new Set<Sim>()
  const createSim = async (room: RoomSource) => {
    const sim = await createBaseSim({ room, tuning: HAND_WRITTEN_TUNING })
    const dispose = sim.dispose.bind(sim)
    sim.dispose = () => {
      disposed.add(sim)
      dispose()
    }
    sims.push(sim)
    return sim
  }
  return { sims, disposed, createSim }
}

describe('createPlay', () => {
  it('steps the sim with the held input and hands each result to the demo', async () => {
    const s = seams()
    const results: StepResult[] = []
    const play = await createPlay(s.play, { ...base, onStep: (result) => results.push(result) })
    const startX = readPlayer(play.sim()).x
    play.start()
    for (let i = 0; i < 10; i++) s.frame()
    expect(results.map((result) => result.tick)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10])
    expect(readPlayer(play.sim()).x).toBeGreaterThan(startX)
    expect(s.renderers[0]?.applied).toBe(10)
    play.destroy()
  })

  it("sends the demo's own commands with the move", async () => {
    const s = seams()
    const rejected: string[] = []
    const play = await createPlay(s.play, {
      ...base,
      commands: (sim) => [{ tick: sim.tick, source: 0, seq: sim.tick + 1000, type: 'nothing', payload: {} }],
      onStep: (result) => rejected.push(...result.rejected.map((each) => each.command.type)),
    })
    play.start()
    s.frame()
    // The base's sim knows no 'nothing' command, so it reports it: proof it was sent alongside the move.
    expect(rejected).toEqual(['nothing'])
    play.destroy()
  })

  it("adds the demo's layers to the renderer, and to the new one when the room changes", async () => {
    const s = seams()
    const layer = { view: {} } as RendererLayer
    const play = await createPlay(s.play, { ...base, layers: [layer] })
    expect(s.renderers[0]?.layers).toEqual([layer])
    await play.restart(shifted)
    expect(s.renderers[1]?.layers).toEqual([layer])
    // Taken back from the old renderer before it was destroyed, so destroying it did not destroy them.
    expect(s.renderers[0]?.layers).toEqual([])
    play.destroy()
  })

  it('stops and starts without losing the sim', async () => {
    const s = seams()
    const play = await createPlay(s.play, base)
    play.start()
    s.frame()
    play.stop()
    expect(play.running()).toBe(false)
    expect(s.scheduled).toBe(false)
    expect(play.sim().tick).toBe(1)
    play.start()
    s.frame()
    expect(play.sim().tick).toBe(2)
    play.destroy()
  })

  it('restarts on a fresh sim, and on a new renderer only when the room changed', async () => {
    const s = seams()
    const play = await createPlay(s.play, base)
    const first = play.sim()
    play.start()
    s.frame()
    await play.restart()
    expect(play.sim()).not.toBe(first)
    expect(play.sim().tick).toBe(0)
    expect(s.renderers).toHaveLength(1)
    expect(s.renderers[0]?.resets).toBe(1)
    expect(play.running()).toBe(true)

    await play.restart(shifted)
    expect(s.renderers.map((log) => log.room)).toEqual(['room-1', 'room-2'])
    expect(s.renderers[0]?.destroyed).toBe(true)
    play.destroy()
  })

  it('skips a restart that a newer one overtook, making nothing for it', async () => {
    const s = seams()
    const play = await createPlay(s.play, base)
    const older = play.restart(shifted)
    const newer = play.restart()
    await Promise.all([older, newer])
    // The older restart never made its renderer; the room in play is the original one.
    expect(s.renderers.map((log) => log.room)).toEqual(['room-1'])
    expect(play.sim().tick).toBe(0)
    play.destroy()
  })

  it('stays stopped after a restart when it was stopped', async () => {
    const s = seams()
    const play = await createPlay(s.play, base)
    await play.restart()
    expect(play.running()).toBe(false)
    play.destroy()
  })

  it('resets the layers when the room changes, so they drop what they drew for the old one', async () => {
    const s = seams()
    let resets = 0
    const layer = {
      view: {},
      reset: () => {
        resets++
      },
    } as RendererLayer
    const play = await createPlay(s.play, { ...base, layers: [layer] })
    await play.restart(shifted)
    expect(resets).toBe(1)
    play.destroy()
  })

  it('keeps the old room playing when the new room cannot start', async () => {
    const s = seams()
    const { sims, disposed, createSim } = trackedSims()
    const layer = { view: {} } as RendererLayer
    const play = await createPlay(
      {
        ...s.play,
        createRenderer: async (room) => {
          if (room.id === shifted.id) throw new Error('no WebGL')
          return s.play.createRenderer(room)
        },
      },
      { ...base, createSim, layers: [layer] },
    )
    play.start()
    await expect(play.restart(shifted)).rejects.toThrow('no WebGL')
    // The old sim and renderer play on, the layers back on it; the sim made for the new room is gone.
    expect(play.sim()).toBe(sims[0])
    expect(disposed).toEqual(new Set([sims[1]]))
    expect(s.renderers[0]?.layers).toEqual([layer])
    expect(s.renderers[0]?.destroyed).toBe(false)
    expect(play.running()).toBe(true)
    s.frame()
    expect(play.sim().tick).toBe(1)
    play.destroy()
  })

  it('a restart still running when the room is destroyed makes nothing that outlives it', async () => {
    const s = seams()
    const { sims, disposed, createSim } = trackedSims()
    const play = await createPlay(s.play, { ...base, createSim })
    const restart = play.restart(shifted)
    play.destroy()
    await restart
    expect(disposed).toEqual(new Set(sims))
    expect(s.renderers.every((log) => log.destroyed)).toBe(true)
    expect(s.scheduled).toBe(false)
  })
})
