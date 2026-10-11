import { Cause, Effect, Exit, Option } from 'effect'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { BaseBootFailed } from './boot.ts'
import { RendererFailed, SimFailed } from './boot-failure.ts'

// startGame's boot steps in Node: each step that can fail is replaced by a fake, so a failure arrives as the
// typed error the error screen reads (boot-failure.ts), not as a defect.
const fakes = vi.hoisted(() => ({
  connect: { fail: false },
  sim: { fail: false },
  renderer: { fail: false },
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
  createBaseSim: () =>
    fakes.sim.fail ? Promise.reject(new Error('wasm blocked')) : Promise.resolve({ dispose() {} }),
}))
vi.mock('./screens/screens.ts', () => ({
  createScreens: () => ({ stage: {}, touchButtons: [], show() {} }),
}))
vi.mock('./render/renderer.ts', () => ({
  createRenderer: () =>
    fakes.renderer.fail
      ? Promise.reject(new Error('no canvas context'))
      : Promise.reject(new Error('unused')),
}))

const { startGame } = await import('./game.ts')

async function failureOf(): Promise<unknown> {
  const exit = await Effect.runPromiseExit(startGame({} as HTMLElement))
  if (Exit.isSuccess(exit)) throw new Error('expected startGame to fail')
  return Option.getOrUndefined(Cause.failureOption(exit.cause))
}

beforeEach(() => {
  fakes.connect.fail = false
  fakes.sim.fail = false
  fakes.renderer.fail = false
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

  it('RendererFailed when the renderer cannot start', async () => {
    fakes.renderer.fail = true
    expect(await failureOf()).toBeInstanceOf(RendererFailed)
  })
})
