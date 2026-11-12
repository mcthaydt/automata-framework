import { CameraHeading } from '@automata/3d/sim'
import { describe, expect, it } from 'vitest'
import { Ada } from '#src/shared/ada.component.ts'
import { boot } from '#src/testing/harness.ts'

// The camera takes the view of the room Ada stands in: the level's sectors name their view (`hall`, `corridor`, `closet`), and
// the views' numbers (where it looks, how far back, how closely it follows) are the level's own.

// The camera stands south of her and looks north, so the stick pushed up walks her toward -z: the corridor, at the hall's north.
const NORTH = { x: 0, y: -127 }

async function viewAfter(seconds: number, stick?: { x: number; y: number }): Promise<string> {
  const game = await boot()
  game.hold(seconds, stick)
  const [ada] = game.sim.query(Ada, CameraHeading)
  if (ada === undefined) throw new Error('the sim has no Ada')
  return ada.get(CameraHeading).view
}

describe('the camera view', () => {
  it('is the hall at the start, where the level puts Ada', async () => {
    expect(await viewAfter(0.2)).toBe('hall')
  })

  it('becomes the corridor when she walks into it', async () => {
    expect(await viewAfter(4, NORTH)).toBe('corridor')
  })

  it('has a view for every one the level names', async () => {
    const game = await boot()
    expect(game.play.views.map((view) => view.id).sort()).toEqual(['closet', 'corridor', 'hall'])
    expect(game.play.views.find((view) => view.id === 'corridor')).toMatchObject({
      distance: 16.8,
      lensMm: 79,
      follow: 1,
    })
  })
})
