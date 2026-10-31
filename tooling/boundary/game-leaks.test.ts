import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { GAME_FIELDS, gameLeakFindings, M6_PACKAGES } from './game-leaks.ts'

// M6.3 (M6 spec L-a, as amended by M6.0a): the adventure source is not edited, so its leaks are removed in the Plus
// rewrites. This rule keeps them out: an extension package never imports a scene or a game, and an M6 package never
// keeps device storage (M6-D8) or one game's contract fields.

let root: string
beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), 'game-leaks-'))
  write('starters/party-racer/package.json', JSON.stringify({ name: 'party-racer' }))
})
afterEach(() => rmSync(root, { recursive: true, force: true }))
function write(path: string, text: string): void {
  mkdirSync(dirname(join(root, path)), { recursive: true })
  writeFileSync(join(root, path), text)
}

describe('gameLeakFindings', () => {
  it('reports a scene import in any extension package, with its file and line', () => {
    write('packages/net/src/a.ts', "export const a = 1\nimport { MAP } from '../scenes/clinic/map'\n")
    write('packages/sectors/src/b.ts', "export { DEFS } from './content/scenes/hall'\n")
    expect(gameLeakFindings(root)).toEqual([
      'packages/net/src/a.ts:2: "../scenes/clinic/map" imports a scene',
      'packages/sectors/src/b.ts:1: "./content/scenes/hall" imports a scene',
    ])
  })

  it('reports an import of a game, by workspace name or by a path that leaves the package', () => {
    write(
      'packages/nav/src/a.ts',
      "import { x } from 'party-racer/sim'\nimport { y } from '../../../starters/party-racer/src/y'\n",
    )
    write('packages/nav/src/ok.ts', "import { z } from '../sim/z'\nimport { w } from './w'\n")
    expect(gameLeakFindings(root)).toEqual([
      'packages/nav/src/a.ts:1: "party-racer/sim" imports a game',
      'packages/nav/src/a.ts:2: "../../../starters/party-racer/src/y" imports from outside its package',
    ])
  })

  it('reports device storage and game fields in the M6 packages, outside comments and tests', () => {
    write(
      'packages/feel/src/store.ts',
      "// never localStorage\n/* sessionStorage, no */\nconst raw = localStorage.getItem('game.feel')\n",
    )
    write('packages/systems/src/world.ts', 'export interface World {\n  readonly torchTime: number\n}\n')
    write('packages/feel/src/store.test.ts', "vi.stubGlobal('localStorage', {})\n")
    expect(gameLeakFindings(root)).toEqual([
      'packages/feel/src/store.ts:3: "localStorage" is device storage; use core Settings or Save (M6-D8)',
      'packages/systems/src/world.ts:2: "torchTime" is one game\'s field (M6 spec §2.3)',
    ])
  })

  it('leaves storage alone outside the M6 packages (net keeps its seat token in sessionStorage)', () => {
    write('packages/net/src/seat-token.ts', 'const store = sessionStorage\n')
    expect(gameLeakFindings(root)).toEqual([])
  })

  it('names the M6 packages and the game fields it keeps out', () => {
    expect(M6_PACKAGES).toEqual([
      'feel',
      'debug',
      'sectors',
      'nav',
      'puzzle',
      'systems',
      'narrative',
      'cutscenes',
      'audio-synth',
    ])
    expect(GAME_FIELDS).toEqual(['basinFull', 'torchTime'])
  })
})

describe('the Plus workspace', () => {
  it('has no game leak', () => {
    expect(gameLeakFindings(fileURLToPath(new URL('../..', import.meta.url)))).toEqual([])
  })
})
