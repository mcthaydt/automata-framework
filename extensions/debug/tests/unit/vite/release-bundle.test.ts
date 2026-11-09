// DB-b: a release build contains no overlay marker and no `__automataDebug`; a debug import left in release code fails the test.
import { describe, expect, it } from 'vitest'
import { bundle, DRIVER_MARKER, OVERLAY_MARKER } from '#src/testing/bundle.ts'

describe('the release bundle', () => {
  it('has neither the overlay nor the driver when the gate is off', async () => {
    const code = await bundle('guarded', false)
    expect(code).not.toContain(OVERLAY_MARKER)
    expect(code).not.toContain(DRIVER_MARKER)
  })
  it('has both in a dev or --debug build', async () => {
    const code = await bundle('guarded', true)
    expect(code).toContain(OVERLAY_MARKER)
    expect(code).toContain(DRIVER_MARKER)
  })
  it('catches a game that imports debug without the gate', async () => {
    const code = await bundle('leaky', false)
    expect(code).toContain(OVERLAY_MARKER)
    expect(code).toContain(DRIVER_MARKER)
  })
}, 120_000)
