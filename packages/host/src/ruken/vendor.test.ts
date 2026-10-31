import { Ruken } from '@ruken/sdk'
import { createFakeHost, settle } from '@ruken/sdk-host/testing'
import { describe, expect, it } from 'vitest'

// Proves the vendored tarballs install and talk to each other (plan Task 1).
describe('vendored Ruken packages', () => {
  it('the real SDK completes the handshake with the fake host', async () => {
    const host = createFakeHost({
      gameOrigin: 'http://localhost:4400',
      gameId: 'blank',
      clock: {
        epochMs: () => Date.now(),
        setTimeout: (fn, ms) => setTimeout(fn, ms),
        clearTimeout: (handle) => clearTimeout(handle as ReturnType<typeof setTimeout>),
      },
    })
    if (host.gameEnv === null) throw new Error('expected in-memory ports')
    const pending = Ruken.init({ gameId: 'blank', pauseBehavior: 'pause' }, host.gameEnv)
    await settle()
    const session = await pending
    expect(session.hosted).toBe(true)
    session.dispose()
    host.dispose()
  })
})
