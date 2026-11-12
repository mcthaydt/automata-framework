import { beforeEach, describe, expect, it } from 'vitest'
import { noteEvents, resetScreen, screen } from '#src/app/screen-state.ts'
import { wordsOf } from '#src/app/words.ts'
import { playRoute } from '#src/testing/bot.ts'
import { ROUTE } from '#src/testing/route.ts'

// What the examine box shows is what the sim said, in words that exist: a line the puzzle says is a key of the lines file, and
// the title is the name of the place it was said at. A key with no words would reach the player as a console error and an empty
// box (a journey found it).

beforeEach(resetScreen)

describe('the examine box', () => {
  it('shows a line said at a hotspot, under the hotspot’s name', () => {
    noteEvents([
      {
        type: 'puzzle.said',
        payload: { action: 'noticeboard.first', at: 'noticeboard', line: 'handover', gained: [] },
      },
    ])
    expect(screen.examine).toEqual({ title: 'hotspot.noticeboard', line: 'prologue.handover' })
  })

  it('has no title for what is not a place (combining, the keypad)', () => {
    noteEvents([
      {
        type: 'puzzle.said',
        payload: { action: 'combine.fill', at: 'combine', line: 'combineFluid', gained: [] },
      },
    ])
    expect(screen.examine).toEqual({ title: undefined, line: 'prologue.combineFluid' })
  })

  it('shows nothing for a line with no words', () => {
    noteEvents([{ type: 'puzzle.said', payload: { action: 'x', at: 'bed', line: '', gained: [] } }])
    expect(screen.examine).toBeUndefined()
  })

  it('has words for every line the prologue says, and for the name of every place it says it at', async () => {
    const run = await playRoute(ROUTE, 1)
    const said = run.events.filter((event) => event.type === 'puzzle.said')
    expect(said.length).toBeGreaterThan(5)
    for (const event of said) {
      resetScreen()
      noteEvents([event])
      const shown = screen.examine
      if (shown === undefined) continue
      expect(wordsOf(shown.line), `no words for ${shown.line}`).toBeDefined()
      if (shown.title !== undefined) expect(wordsOf(shown.title), `no words for ${shown.title}`).toBeDefined()
    }
  })
})
