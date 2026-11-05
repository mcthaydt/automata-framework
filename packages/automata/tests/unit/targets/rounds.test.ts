import { describe, expect, it } from 'vitest'
import { guardRounds } from '#src/features/targets/rounds.ts'

// FloorFifty tests/client/ruken/hosting.test.ts, "sends one round start per round, and an end only for an open round".
describe('guardRounds', () => {
  it('passes one start per round and an end only for an open round', () => {
    const sent: string[] = []
    const rounds = guardRounds({
      start: () => sent.push('start'),
      end: (outcome) => sent.push(`end:${outcome}`),
    })
    rounds.end('quit')
    rounds.start()
    rounds.start()
    rounds.end('complete')
    rounds.end('quit')
    expect(sent).toEqual(['start', 'end:complete'])
  })

  it('opens a new round after the last one ended', () => {
    const sent: string[] = []
    const rounds = guardRounds({
      start: () => sent.push('start'),
      end: (outcome) => sent.push(`end:${outcome}`),
    })
    rounds.start()
    rounds.end('fail')
    rounds.start()
    expect(sent).toEqual(['start', 'end:fail', 'start'])
  })
})
