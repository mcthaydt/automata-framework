import { describe, expect, it } from 'vitest'
import { eventIds } from '#src/features/vite/event-ids.ts'

// The events a game can say, for Feel and Audio's "What happens in the game?": found by reading the game's event files
// as text, not by running them.

const file = (path: string, text: string) => ({ path, text })

describe('eventIds', () => {
  it('lists the ids of every event file, sorted and once each', () => {
    expect(
      eventIds([
        file('src/shared/player.event.ts', "export const Jumped = defineEvent('player.jumped', at)\n"),
        file(
          'src/shared/goal.event.ts',
          'export const Reached = defineEvent("goal.reached", at)\nexport const Again = defineEvent(\'player.jumped\', at)\n',
        ),
      ]),
    ).toEqual(['goal.reached', 'player.jumped'])
  })

  it('skips an id that is not a string written out, and a file that is not an event file', () => {
    expect(
      eventIds([
        file(
          'src/a.event.ts',
          'const id = "x.y"\nexport const A = defineEvent(id, at)\nexport const B = defineEvent(`t.${id}`, at)\n',
        ),
        file('src/b.ts', "export const C = defineEvent('not.an.event.file', at)\n"),
        file('src/c.event.ts', "export const D = defineEvent( 'spaced.out' , at)\n"),
      ]),
    ).toEqual(['spaced.out'])
  })

  it('is empty for a game with no event files', () => {
    expect(eventIds([])).toEqual([])
  })
})
