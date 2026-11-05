import { describe, expect, it } from 'vitest'

// The entries demos import (examples/README.md), resolved by package name as a demo resolves them. The root
// and ./sim stay free of Pixi, so Node code (sims, goldens) that reads the room or the plugin never loads the
// renderer; the game and the renderer have their own entries.
// Each test imports a whole entry cold, which took 5.6 s on a loaded runner (past vitest's 5 s default) and
// 30.5 s while Ruken's CI shared the runner (2026-10-16), so the block gets the root script's 90 s default.
describe('@af-games/emberwick entries', { timeout: 90_000 }, () => {
  it('the root has the sim setup, the room and the game id, but not the game', async () => {
    const root = await import('@af-games/emberwick')
    expect(typeof root.createBaseSim).toBe('function')
    expect(root.GAME_ID).toBe('emberwick')
    expect('startGame' in root).toBe(false)
  })

  // ./game imports the whole game, screens and renderer included: it timed out at 90 s on a loaded af-mac runner
  // (PRs #105, #106 and #116, twice, 2026-10-23). This test alone gets 240 s; its assertions are unchanged.
  it('./game has the game as one definition for `startGame`', { timeout: 240_000 }, async () => {
    const game = await import('@af-games/emberwick/game')
    expect(game.emberwick.id).toBe('emberwick')
    expect(game.emberwick.screens.map((screen) => screen.id)).toEqual([
      'splash',
      'menu',
      'room',
      'paused',
      'end',
    ])
  })

  it('./sim has the sim plugin and its definitions, for a demo’s own sim root', async () => {
    const sim = await import('@af-games/emberwick/sim')
    expect(sim.emberwickPlugin.name).toBe('emberwick')
    expect(sim.Player).toBeDefined()
  })
})
