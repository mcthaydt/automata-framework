import { content } from 'virtual:automata/content'
import { CutsceneEnded } from '@automata/cutscenes/sim'
import type { Sim } from '@automata/sim'
import { describe, expect, it } from 'vitest'
import { playOf } from '#src/app/content.ts'
import { createGameSim } from '#src/app/game-sim.ts'
import { Ada } from '#src/shared/ada.component.ts'
import { boot } from '#src/testing/harness.ts'

// Ada's facing at the moments the old game fixes it, seen in its own play (no `?debug`, 1024 by 768): she is placed facing north, away
// from the play camera (the old spawn's pi); the opening's last key turns her to face us (`facing: 0`), so the cutscene's last frames
// show her front; and in play she is back to the camera again, because the heading the stick leaves is the spawn's. The old
// comment ("play starts where the cutscene leaves it, with her whole and facing us", `scenes/prologue/cutscenes.ts`) is about her
// being whole, not about her heading: the old game's first play frames show her turning her back.

/** Her heading in the sim now (radians; 0 faces +z, toward the play camera). */
const yawOf = (game: { readonly sim: Sim }): number => {
  const [ada] = game.sim.query(Ada)
  if (ada === undefined) throw new Error('the sim has no Ada')
  return ada.get(Ada).yaw
}

describe('Ada’s facing', () => {
  it('is pi at the spawn: her back to the camera, as the old game placed her', async () => {
    // Before the first tick: the opening starts on it, and a cutscene draws her from its own keys.
    const sim = await createGameSim(playOf(content), 1)
    expect(yawOf({ sim })).toBeCloseTo(Math.PI, 5)
    sim.dispose()
  })

  it('is turned to the camera by the opening’s last key, and is back to it when the stick is hers', async () => {
    const game = await boot(1, undefined, { opening: true })
    const script = game.play.scripts.find((cutscene) => cutscene.id === 'opening')
    const keys = script?.actor?.filter((actor) => actor.who === 'player') ?? []
    // What the file says: its last key for her faces the camera.
    expect(keys[keys.length - 1]?.facing).toBe(0)
    game.hold(18)
    expect(game.events(CutsceneEnded)).toEqual([expect.objectContaining({ id: 'opening', skipped: false })])
    expect(yawOf(game)).toBeCloseTo(Math.PI, 5)
  })

  it('is back to the camera after a skip too: the handover is the same either way', async () => {
    const game = await boot()
    expect(game.events(CutsceneEnded)).toEqual([expect.objectContaining({ id: 'opening', skipped: true })])
    expect(yawOf(game)).toBeCloseTo(Math.PI, 5)
  })
})
