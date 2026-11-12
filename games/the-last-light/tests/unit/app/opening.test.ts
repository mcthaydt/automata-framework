import { CutsceneEnded, CutsceneStarted, CutsceneState } from '@automata/cutscenes/sim'
import { describe, expect, it } from 'vitest'
import { SCRIPTS } from '#src/app/words.ts'
import { boot } from '#src/testing/harness.ts'

// The prologue opens on the opening cutscene, as the old game's begin did: it starts on the first tick in the sim (a
// cutscene holds the input, which is game state), plays its 17 seconds and hands Ada the stick; a player may skip it.

describe('the opening', () => {
  it('starts on the first tick and holds the input', async () => {
    const game = await boot(1, undefined, { opening: true })
    expect(game.events(CutsceneStarted)).toEqual([expect.objectContaining({ id: 'opening' })])
    expect(game.sim.resource(CutsceneState).id).toBe('opening')
  })

  it('ends by itself after its seventeen seconds', async () => {
    const game = await boot(1, undefined, { opening: true })
    game.hold(16)
    expect(game.sim.resource(CutsceneState).id).toBe('opening')
    game.hold(2)
    expect(game.sim.resource(CutsceneState).id).toBeNull()
    expect(game.events(CutsceneEnded)).toEqual([expect.objectContaining({ id: 'opening', skipped: false })])
  })

  it('can be skipped, and boots skipped unless a test asks for it', async () => {
    const skipped = await boot()
    expect(skipped.sim.resource(CutsceneState).id).toBeNull()
    expect(skipped.events(CutsceneEnded)).toEqual([expect.objectContaining({ id: 'opening', skipped: true })])
  })

  // The old game draws its creature only once she is awake: in the opening her actor is the dormant sim's, alpha 0, so the empty hall
  // is empty (the corridor's mouth is in the first shot). Ours stood at the end of the corridor, in view, until the script said so.
  it('keeps the night nurse out of sight: she is dormant until the lights go', () => {
    const keys = (SCRIPTS.opening?.actor ?? []).filter((key) => key.who === 'nurse')
    expect(keys.length).toBeGreaterThan(0)
    for (const key of keys) expect(key.alpha).toBe(0)
  })
})

// The lights-out cutscene's figure in the corridor. The old script gives her `facing: 0` and the old game drew her face on to the corridor's
// camera; the painted figure shows her back at 0 from that shot (measured in the picture: the cap's cross and her face only with a facing of
// pi), so her keys here turn her to face it. Whether every cutscene facing reads half a turn off in the painted view is open (the notes).
describe('the lights-out cutscene', () => {
  it('has the night nurse face the camera that looks down the corridor at her', () => {
    const keys = (SCRIPTS.lightsOut?.actor ?? []).filter((key) => key.who === 'nurse' && key.alpha !== 0)
    expect(keys.length).toBeGreaterThan(0)
    for (const key of keys) expect(key.facing).toBeCloseTo(Math.PI, 6)
  })
})
