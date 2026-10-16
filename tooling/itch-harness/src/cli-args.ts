import { resolve } from 'node:path'

const USAGE = 'usage: itch-harness --game <name>=<folder> [--game <name>=<folder> ...]'

/** The games to serve, from `--game <name>=<folder>` pairs; folders resolve against `cwd`. */
export function parseGames(argv: readonly string[], cwd: string): Record<string, string> {
  const games: Record<string, string> = {}
  for (let index = 0; index < argv.length; index += 2) {
    const match = argv[index] === '--game' ? /^([a-z0-9-]+)=(.+)$/.exec(argv[index + 1] ?? '') : null
    if (match === null) throw new Error(USAGE)
    const [, name = '', folder = ''] = match
    games[name] = resolve(cwd, folder)
  }
  if (Object.keys(games).length === 0) throw new Error(USAGE)
  return games
}
