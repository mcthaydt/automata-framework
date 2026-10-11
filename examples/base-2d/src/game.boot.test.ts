import { Cause, Effect, Exit, Option } from 'effect'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { BaseBootFailed } from './boot.ts'
import { RendererFailed, SimFailed } from './boot-failure.ts'
import { readRoomGrid } from './content/room-grid.ts'

// startGame's boot in Node: each step that touches the host, the GPU or the DOM is replaced by a fake, so the
// test sees what startGame does with it (the typed error a failed step becomes, and where a demo's options go).
const fakes = vi.hoisted(() => ({
  connect: { fail: false },
  sim: { fail: false, calls: [] as unknown[], disposed: 0 },
  screens: { callbacks: {} as Record<string, () => void> },
  renderer: { fail: false, layers: [] as unknown[], rooms: [] as unknown[] },
}))

vi.mock('./boot.ts', async (importOriginal) => {
  const real = await importOriginal<typeof import('./boot.ts')>()
  return {
    ...real,
    connect: () =>
      fakes.connect.fail
        ? Effect.fail(new real.BaseBootFailed({ step: 'init', cause: 'no host' }))
        : Effect.succeed({ round: { start() {}, end() {} }, lifecycle: { on() {} } }),
  }
})
vi.mock('./base-sim.ts', async (importOriginal) => ({
  ...(await importOriginal<typeof import('./base-sim.ts')>()),
  createBaseSim: (options: unknown) => {
    fakes.sim.calls.push(options)
    if (fakes.sim.fail) return Promise.reject(new Error('wasm blocked'))
    return Promise.resolve({
      tick: 0,
      dispose() {
        fakes.sim.disposed++
      },
    })
  },
}))
vi.mock('./screens/screens.ts', () => ({
  createScreens: (_root: unknown, callbacks: Record<string, () => void>) => {
    fakes.screens.callbacks = callbacks
    return { stage: {}, touchButtons: [], show() {} }
  },
}))
vi.mock('./input/devices.ts', () => ({
  createInputDevices: () => ({ held: () => new Set(), dispose() {} }),
}))
vi.mock('./render/renderer.ts', () => ({
  createRenderer: (_stage: unknown, room: unknown) => {
    fakes.renderer.rooms.push(room)
    return fakes.renderer.fail
      ? Promise.reject(new Error('no canvas context'))
      : Promise.resolve({
          addLayer: (layer: unknown) => {
            fakes.renderer.layers.push(layer)
            return () => {}
          },
          draw() {},
          reset() {},
          fitToHost() {},
          playerPixel: () => null,
          destroy() {},
        })
  },
}))

const { startGame } = await import('./game.ts')

async function failureOf(): Promise<unknown> {
  const exit = await Effect.runPromiseExit(startGame({ dataset: {} } as HTMLElement))
  if (Exit.isSuccess(exit)) throw new Error('expected startGame to fail')
  return Option.getOrUndefined(Cause.failureOption(exit.cause))
}

beforeEach(() => {
  vi.useFakeTimers()
  vi.stubGlobal('window', { addEventListener() {}, removeEventListener() {} })
  vi.stubGlobal('document', { documentElement: { dataset: {} } })
  vi.stubGlobal('requestAnimationFrame', () => 0)
  vi.stubGlobal('cancelAnimationFrame', () => {})
  fakes.connect.fail = false
  fakes.sim.fail = false
  fakes.sim.calls = []
  fakes.sim.disposed = 0
  fakes.screens.callbacks = {}
  fakes.renderer.fail = false
  fakes.renderer.layers = []
  fakes.renderer.rooms = []
})

afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllGlobals()
})

describe('startGame fails with a typed error at each boot step', () => {
  it('BaseBootFailed when the Ruken handshake fails', async () => {
    fakes.connect.fail = true
    expect(await failureOf()).toBeInstanceOf(BaseBootFailed)
  })

  it('SimFailed when the first sim cannot be made', async () => {
    fakes.sim.fail = true
    expect(await failureOf()).toBeInstanceOf(SimFailed)
  })

  it('SimFailed when the demo’s onRound throws on the first sim', async () => {
    const exit = await Effect.runPromiseExit(
      startGame({ dataset: {} } as HTMLElement, {
        onRound: () => {
          throw new Error('bad spawn')
        },
      }),
    )
    expect(Exit.isFailure(exit) && Option.getOrUndefined(Cause.failureOption(exit.cause))).toBeInstanceOf(
      SimFailed,
    )
  })

  it('RendererFailed when the renderer cannot start', async () => {
    fakes.renderer.fail = true
    expect(await failureOf()).toBeInstanceOf(RendererFailed)
  })
})

describe('startGame options (what a demo adds without copying the game)', () => {
  it('makes the sim with the demo’s plugins, runs onRound on it, and adds the layers', async () => {
    const plugin = { name: 'demo' }
    const layer = { view: {} }
    const rounds: unknown[] = []
    const exit = await Effect.runPromiseExit(
      startGame({ dataset: {} } as HTMLElement, {
        plugins: [plugin as never],
        onRound: (sim) => rounds.push(sim),
        layers: [layer as never],
      }),
    )
    expect(Exit.isSuccess(exit)).toBe(true)
    expect(fakes.sim.calls).toEqual([{ plugins: [plugin] }])
    expect(rounds).toHaveLength(1)
    expect(fakes.renderer.layers).toEqual([layer])
  })

  it('makes every round’s sim from the demo’s compiled content', async () => {
    const content = { rooms: { 'room-1': readRoomGrid(8, ['######', '#....#', '#.P.G#', '######']) } }
    const exit = await Effect.runPromiseExit(startGame({ dataset: {} } as HTMLElement, { content }))
    expect(Exit.isSuccess(exit)).toBe(true)
    expect(fakes.sim.calls).toEqual([{ plugins: [], content }])
  })

  it('draws the room of the demo’s content, the one its sims are made from', async () => {
    const corridor = readRoomGrid(8, ['######', '#....#', '#.P.G#', '######'])
    const exit = await Effect.runPromiseExit(
      startGame({ dataset: {} } as HTMLElement, { content: { rooms: { 'room-1': corridor } } }),
    )
    expect(Exit.isSuccess(exit)).toBe(true)
    expect(fakes.renderer.rooms).toEqual([{ id: 'room-1', ...corridor }])
  })

  it('without options, makes the base sim alone', async () => {
    const exit = await Effect.runPromiseExit(startGame({ dataset: {} } as HTMLElement))
    expect(Exit.isSuccess(exit)).toBe(true)
    expect(fakes.sim.calls).toEqual([{ plugins: [] }])
    expect(fakes.renderer.layers).toEqual([])
  })

  it('applies the plugins and onRound to every round’s sim, not only the first', async () => {
    const plugin = { name: 'demo' }
    const rounds: unknown[] = []
    const exit = await Effect.runPromiseExit(
      startGame({ dataset: {} } as HTMLElement, {
        plugins: [plugin as never],
        onRound: (sim) => rounds.push(sim),
      }),
    )
    expect(Exit.isSuccess(exit)).toBe(true)
    // Splash, menu, Play: Play starts a round on a fresh sim.
    fakes.screens.callbacks.onContinue?.()
    fakes.screens.callbacks.onPlay?.()
    await vi.waitFor(() => expect(rounds).toHaveLength(2))
    expect(fakes.sim.calls).toEqual([{ plugins: [plugin] }, { plugins: [plugin] }])
  })

  it('disposes a sim whose onRound threw', async () => {
    const exit = await Effect.runPromiseExit(
      startGame({ dataset: {} } as HTMLElement, {
        onRound: () => {
          throw new Error('bad spawn')
        },
      }),
    )
    expect(Exit.isFailure(exit)).toBe(true)
    expect(fakes.sim.disposed).toBe(1)
  })
})
