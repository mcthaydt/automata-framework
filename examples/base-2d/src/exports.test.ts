import { describe, expect, it } from 'vitest'

// The entries demos import (examples/README.md), resolved by package name as a demo resolves them.
describe('@af-examples/base-2d entries', () => {
  it('the root has startGame, bootPage and the boot failures', async () => {
    const root = await import('@af-examples/base-2d')
    expect(typeof root.startGame).toBe('function')
    expect(typeof root.bootPage).toBe('function')
    expect(typeof root.SimFailed).toBe('function')
  })

  it('./sim has the sim plugin and its definitions, for a demo’s own sim root', async () => {
    const sim = await import('@af-examples/base-2d/sim')
    expect(sim.base2dPlugin.name).toBe('base-2d')
    expect(sim.Player).toBeDefined()
  })
})
