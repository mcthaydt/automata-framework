import { content } from 'virtual:automata/content'
import { describe, expect, it } from 'vitest'
import { playOf } from '#src/app/content.ts'

// The creature's file carries scenarios (what the Schematic editor plays to check her): each sets facts to start from. A fact
// the game never reads is a scenario that starts from nothing, and the old game's `light` was one: the lamp is `lit` and `fuel` now
// (the lamp feature's facts), so a scenario that says `light = "lighter"` lit no lamp and passed or failed for another reason.

const play = playOf(content)

/** The facts a scenario may set: the puzzle's own, and the lamp's two. An agent's mode and what the figure has seen are `a.b` names. */
const known = new Set([...Object.keys(play.puzzle.facts ?? {}), 'lit', 'fuel'])

describe('the scenarios in the creature’s file', () => {
  const scenarios = play.systems.scenarios

  it('are there', () => {
    expect(scenarios.length).toBeGreaterThan(2)
  })

  for (const scenario of scenarios)
    it(`${scenario.id} starts from facts the game reads`, () => {
      const unknown = Object.keys(scenario.setup.facts ?? {}).filter(
        (fact) => !fact.includes('.') && !known.has(fact),
      )
      expect(unknown).toEqual([])
    })
})
