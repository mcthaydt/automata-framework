import { describe, expect, it } from 'vitest'

// The entries demos import (examples/README.md), resolved by package name as a demo resolves them. The root
// and ./sim stay free of Pixi, so Node code (sims, goldens) that reads the room or the plugin never loads the
// renderer; the game and the renderer have their own entries.
// Each test imports a whole entry cold, which took 5.6 s on a loaded runner (past vitest's 5 s default) and
// 30.5 s while Ruken's CI shared the runner (2026-10-16), so the block gets the root script's 90 s default.
describe('@af-examples/base-2d entries', { timeout: 90_000 }, () => {
  it('the root has the sim setup, the room, bootPage and the boot failures, but not the game', async () => {
    const root = await import('@af-examples/base-2d')
    expect(typeof root.createBaseSim).toBe('function')
    expect(typeof root.bootPage).toBe('function')
    expect(typeof root.SimFailed).toBe('function')
    expect('startGame' in root).toBe(false)
  })

  it('./game has the game as one definition for `startGame`', async () => {
    const game = await import('@af-examples/base-2d/game')
    expect(game.emberwick.id).toBe('base-2d')
    expect(game.emberwick.screens.map((screen) => screen.id)).toEqual([
      'splash',
      'menu',
      'room',
      'paused',
      'end',
    ])
  })

  it('./sim has the sim plugin and its definitions, for a demo’s own sim root', async () => {
    const sim = await import('@af-examples/base-2d/sim')
    expect(sim.base2dPlugin.name).toBe('base-2d')
    expect(sim.Player).toBeDefined()
  })
})
