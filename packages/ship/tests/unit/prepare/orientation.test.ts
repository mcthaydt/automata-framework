import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  declaredOrientationIn,
  findOrientationMismatches,
  gameOrientationsIn,
  isOrientationSource,
} from '#src/prepare/orientation.ts'

// The orientation check (M4.7 follow-up): the orientation a game plays in (`defineGame({ orientation })`, `any`
// when left out) must be the `runtime.orientation` its ship config sends Ruken. Read from the sources, as the
// board check does, so a failure names the call site.

function game(files: Record<string, string>): string {
  const dir = mkdtempSync(join(tmpdir(), 'orientation-'))
  for (const [path, text] of Object.entries(files)) {
    mkdirSync(dirname(join(dir, path)), { recursive: true })
    writeFileSync(join(dir, path), text)
  }
  return dir
}

const playing = (orientation: string) => `import { defineGame } from '@mcthaydt/automata'
export default defineGame({
  id: 'g',
  orientation: '${orientation}',
})
`

describe('gameOrientationsIn', () => {
  it('reads the literal orientation of a defineGame call, at its opening quote', () => {
    expect(gameOrientationsIn('src/game.ts', playing('landscape'))).toEqual([
      { orientation: 'landscape', line: 4, col: 16 },
    ])
  })

  it('reads `any` at the call when the game does not say, since that is what the game plays in', () => {
    expect(gameOrientationsIn('game.ts', "export default defineGame({ id: 'g' })\n")).toEqual([
      { orientation: 'any', line: 1, col: 16 },
    ])
  })

  it('reads every defineGame call in a file, in source order', () => {
    const code = `${playing('portrait')}export const other = defineGame({ id: 'h' })\n`
    expect(gameOrientationsIn('game.ts', code)).toEqual([
      { orientation: 'portrait', line: 4, col: 16 },
      { orientation: 'any', line: 6, col: 22 },
    ])
  })

  it('leaves out a call whose orientation is not a literal, or whose argument is not an object literal', () => {
    expect(
      gameOrientationsIn(
        'game.ts',
        "const o = 'landscape'\nexport const a = defineGame({ id: 'g', orientation: o })\nexport const b = defineGame(spec)\nexport const c = defineGame({ ...spec })\n",
      ),
    ).toEqual([])
  })

  it('is undefined for a file that does not parse, since a half-read tree could name an orientation that is not there', () => {
    expect(gameOrientationsIn('game.ts', "defineGame({ orientation: 'landscape' ")).toBeUndefined()
  })
})

describe('declaredOrientationIn', () => {
  it('reads the literal runtime.orientation of a ship config as written', () => {
    const code = `export default defineShipConfig({
  game: { id: 'g' },
  runtime: { renderer: 'webgl2', orientation: 'landscape', inputs: ['touch'] },
})
`
    expect(declaredOrientationIn(code)).toBe('landscape')
  })

  it('is undefined when runtime or its orientation is not written as a literal, or the file does not parse', () => {
    expect(declaredOrientationIn("export default defineShipConfig({ game: { id: 'g' } })")).toBeUndefined()
    expect(
      declaredOrientationIn('export default defineShipConfig({ runtime: { orientation: o } })'),
    ).toBeUndefined()
    expect(declaredOrientationIn('export default defineShipConfig({ runtime: shared })')).toBeUndefined()
    expect(declaredOrientationIn('export default defineShipConfig({ runtime: {')).toBeUndefined()
  })
})

describe('isOrientationSource', () => {
  it('reads sources, not tests, the build, dependencies or dot folders', () => {
    expect(isOrientationSource('src/game.ts')).toBe(true)
    expect(isOrientationSource('src/game.test.ts')).toBe(false)
    expect(isOrientationSource('src/game.spec.tsx')).toBe(false)
    expect(isOrientationSource('dist/assets/main.js')).toBe(false)
    expect(isOrientationSource('node_modules/x/index.ts')).toBe(false)
    expect(isOrientationSource('.turbo/x.ts')).toBe(false)
    expect(isOrientationSource('src/style.css')).toBe(false)
  })
})

describe('findOrientationMismatches', () => {
  it('passes a game that plays in the orientation its config declares', () => {
    expect(findOrientationMismatches(game({ 'src/game.ts': playing('landscape') }), 'landscape')).toEqual([])
    expect(findOrientationMismatches(game({ 'src/game.ts': "defineGame({ id: 'g' })\n" }), 'any')).toEqual([])
  })

  it('names a mismatch with its file, line and column, and both orientations', () => {
    const dir = game({ 'src/game.ts': playing('landscape') })
    expect(findOrientationMismatches(dir, 'any')).toEqual([
      { orientation: 'landscape', declared: 'any', file: 'src/game.ts', line: 4, col: 16 },
    ])
  })

  it('names a game that leaves the orientation out against a config that declares one', () => {
    const dir = game({ 'game.ts': "export default defineGame({ id: 'g' })\n" })
    expect(findOrientationMismatches(dir, 'portrait')).toEqual([
      { orientation: 'any', declared: 'portrait', file: 'game.ts', line: 1, col: 16 },
    ])
  })

  it('never reads tests, node_modules or the build, and finds nothing in a game with no defineGame call', () => {
    const dir = game({
      'src/game.test.ts': playing('portrait'),
      'node_modules/x/index.ts': playing('portrait'),
      'dist/assets/index.js': playing('portrait'),
      'src/page.ts': 'export const page = 1\n',
    })
    expect(findOrientationMismatches(dir, 'landscape')).toEqual([])
  })
})
