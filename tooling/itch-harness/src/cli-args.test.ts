import { describe, expect, it } from 'vitest'
import { parseGames } from './cli-args.ts'

describe('the harness command line', () => {
  it('reads each --game name=folder, resolving folders against the working directory', () => {
    expect(parseGames(['--game', 'placeholder=dist-itch', '--game', 'base-2d=/b/dist-itch'], '/w')).toEqual({
      placeholder: '/w/dist-itch',
      'base-2d': '/b/dist-itch',
    })
  })

  it.each([[[]], [['--game']], [['--game', 'nofolder']], [['--game', '=x']], [['--port', '1']]])(
    'refuses %j',
    (argv) => {
      expect(() => parseGames(argv, '/w')).toThrow(/usage: itch-harness --game <name>=<folder>/)
    },
  )
})
