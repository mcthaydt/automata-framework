import type { Command, StepResult } from '@mcthaydt/automata-sim'
import type { Container } from 'pixi.js'
import { describe, expect, it } from 'vitest'
import { readPlayer } from './base-sim.ts'
import { ROOM, type Room, type RoomSource } from './content/room.ts'
import type { Held } from './input/keys.ts'
import { STEP_MS } from './loop.ts'
import { createPlay, type PlaySeams } from './play-room.ts'
import type { Renderer } from './render/renderer.ts'

/** A renderer that records what it was given instead of drawing. */
function fakeRenderer(room: Room) {
  const log = { room: room.id, applied: 0, draws: 0, resets: 0, destroyed: false }
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
    layer: { label: `layer of ${room.id}` } as unknown as Container,
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

describe('createPlay', () => {
  it('steps the sim with the held input and hands each result to the demo', async () => {
    const s = seams()
    const results: StepResult[] = []
    const play = await createPlay(s.play, { onStep: (result) => results.push(result) })
    const startX = readPlayer(play.sim()).x
    play.start()
    for (let i = 0; i < 10; i++) s.frame()
    expect(results.map((result) => result.tick)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10])
    expect(readPlayer(play.sim()).x).toBeGreaterThan(startX)
    expect(s.renderers[0]?.applied).toBe(10)
    play.destroy()
  })

  it("sends the demo's own commands with the move, and hands it the renderer's layer each frame", async () => {
    const s = seams()
    const sent: Command[][] = []
    const drawn: string[] = []
    const play = await createPlay(s.play, {
      commands: (sim) => [{ tick: sim.tick, source: 0, seq: sim.tick + 1000, type: 'nothing', payload: {} }],
      onStep: (result) => sent.push([...result.rejected.map((rejected) => rejected.command)]),
      onDraw: (layer, sim) => drawn.push(`${(layer as unknown as { label: string }).label} at ${sim.tick}`),
    })
    play.start()
    s.frame()
    // The base's sim knows no 'nothing' command, so it reports it: proof it was sent alongside the move.
    expect(sent[0]?.map((command) => command.type)).toEqual(['nothing'])
    expect(drawn).toEqual(['layer of room-1 at 1'])
    play.destroy()
  })

  it('stops and starts without losing the sim', async () => {
    const s = seams()
    const play = await createPlay(s.play)
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
    const play = await createPlay(s.play)
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
    const play = await createPlay(s.play)
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
    const play = await createPlay(s.play)
    await play.restart()
    expect(play.running()).toBe(false)
    play.destroy()
  })
})
