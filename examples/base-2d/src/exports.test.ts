import { describe, expect, it } from 'vitest'

// The entries demos import (examples/README.md), resolved by package name as a demo resolves them. The root
// and ./sim stay free of Pixi, so Node code (sims, goldens) that reads the room or the plugin never loads the
// renderer; the game and the renderer have their own entries.
describe('@af-examples/base-2d entries', () => {
  it('the root has the sim setup, the room, bootPage and the boot failures, but not the game', async () => {
    const root = await import('@af-examples/base-2d')
    expect(typeof root.createBaseSim).toBe('function')
    expect(typeof root.bootPage).toBe('function')
    expect(typeof root.SimFailed).toBe('function')
    expect('startGame' in root).toBe(false)
  })

  it('./game has startGame', { timeout: 30_000 }, async () => {
    const game = await import('@af-examples/base-2d/game')
    expect(typeof game.startGame).toBe('function')
  })

  it('./sim has the sim plugin and its definitions, for a demo’s own sim root', async () => {
    const sim = await import('@af-examples/base-2d/sim')
    expect(sim.base2dPlugin.name).toBe('base-2d')
    expect(sim.Player).toBeDefined()
  })
})
