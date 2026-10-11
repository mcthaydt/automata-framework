import { Cause, Effect, Exit, FiberId } from 'effect'
import { describe, expect, it } from 'vitest'
import { BaseBootFailed } from './boot.ts'
import {
  bootFailureMessage,
  CONNECT_FAILED,
  DEVICE_FAILED,
  RendererFailed,
  SimFailed,
} from './boot-failure.ts'

// The page's error screen picks its message from how startGame failed. Run through Effect.runPromiseExit, as
// main.ts does: Effect.runPromise would hand back a FiberFailure wrapper with no `_tag` of its own.
async function messageFor(program: Effect.Effect<void, unknown>): Promise<string> {
  const exit = await Effect.runPromiseExit(program)
  if (Exit.isSuccess(exit)) throw new Error('expected the program to fail')
  return bootFailureMessage(exit.cause)
}

describe('bootFailureMessage', () => {
  it('blames the connection only when the Ruken handshake or ready failed', async () => {
    expect(await messageFor(Effect.fail(new BaseBootFailed({ step: 'init', cause: 'no host' })))).toBe(
      CONNECT_FAILED,
    )
    expect(await messageFor(Effect.fail(new BaseBootFailed({ step: 'ready', cause: 'timeout' })))).toBe(
      CONNECT_FAILED,
    )
  })

  it('says the device cannot run the game when the renderer or the sim (Rapier) could not load', async () => {
    expect(await messageFor(Effect.fail(new RendererFailed({ cause: 'no WebGL2' })))).toBe(DEVICE_FAILED)
    expect(await messageFor(Effect.fail(new SimFailed({ cause: 'wasm blocked' })))).toBe(DEVICE_FAILED)
  })

  it('says the device cannot run the game for anything unexpected (a defect or an interruption)', async () => {
    expect(await messageFor(Effect.die(new Error('bug')))).toBe(DEVICE_FAILED)
    expect(bootFailureMessage(Cause.interrupt(FiberId.none))).toBe(DEVICE_FAILED)
  })
})
