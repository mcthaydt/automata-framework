import { Cause, Effect, Exit, Option } from 'effect'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { BaseBootFailed } from './boot.ts'
import { RendererFailed, SimFailed } from './boot-failure.ts'

// startGame's boot in Node: each step that touches the host, the GPU or the DOM is replaced by a fake, so the
// test sees what startGame does with it (the typed error a failed step becomes, and where a demo's options go).
const fakes = vi.hoisted(() => ({
  connect: { fail: false },
  sim: { fail: false, calls: [] as unknown[] },
  renderer: { fail: false, layers: [] as unknown[] },
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
    return fakes.sim.fail
      ? Promise.reject(new Error('wasm blocked'))
      : Promise.resolve({ tick: 0, dispose() {} })
  },
}))
vi.mock('./screens/screens.ts', () => ({
  createScreens: () => ({ stage: {}, touchButtons: [], show() {} }),
}))
vi.mock('./input/devices.ts', () => ({
  createInputDevices: () => ({ held: () => new Set(), dispose() {} }),
}))
vi.mock('./render/renderer.ts', () => ({
  createRenderer: () =>
    fakes.renderer.fail
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
        }),
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
  fakes.connect.fail = false
  fakes.sim.fail = false
  fakes.sim.calls = []
  fakes.renderer.fail = false
  fakes.renderer.layers = []
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

  it('without options, makes the base sim alone', async () => {
    const exit = await Effect.runPromiseExit(startGame({ dataset: {} } as HTMLElement))
    expect(Exit.isSuccess(exit)).toBe(true)
    expect(fakes.sim.calls).toEqual([{ plugins: [] }])
    expect(fakes.renderer.layers).toEqual([])
  })
})
