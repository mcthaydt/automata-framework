import { mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { eventIds, writeEventIds } from '#src/features/vite/event-ids.ts'

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

describe('writeEventIds', () => {
  it('never shows a reader half a file while the list is rewritten', async () => {
    const root = mkdtempSync(join(tmpdir(), 'af-events-'))
    try {
      mkdirSync(join(root, 'src'), { recursive: true })
      const ids = (count: number) =>
        Array.from({ length: count }, (_, at) => `defineEvent('event.number.${at}', at)`).join('\n')
      const target = join(root, '.automata', 'events.json')
      // The editors read this file from the dev server while a save rewrites it: a reader must get a whole list.
      let torn = 0
      let writing = true
      const reader = (async () => {
        while (writing) {
          try {
            JSON.parse(readFileSync(target, 'utf8'))
          } catch (error) {
            if ((error as NodeJS.ErrnoException).code !== 'ENOENT') torn++
          }
          await new Promise((resolve) => setImmediate(resolve))
        }
      })()
      for (let round = 1; round <= 150; round++) {
        writeFileSync(join(root, 'src', 'a.event.ts'), ids(200 + round))
        await writeEventIds(root, '.automata')
      }
      writing = false
      await reader
      expect(torn).toBe(0)
      expect(readdirSync(join(root, '.automata'))).toEqual(['events.json'])
    } finally {
      rmSync(root, { recursive: true, force: true })
    }
  })
})
