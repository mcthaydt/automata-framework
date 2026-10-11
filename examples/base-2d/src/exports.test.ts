import { describe, expect, it } from 'vitest'

// The entries demos import (examples/README.md), resolved by package name as a demo resolves them. The root
// loads Pixi and the game, about 2 s cold here, so the root's test gets room for a loaded runner.
describe('@af-examples/base-2d entries', { timeout: 30_000 }, () => {
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
