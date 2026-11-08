import { mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { type TexturedSwatch, textureOf } from '#src/features/textures/swatch-tiles.ts'
import { readKitSwatches, runTextures } from '#src/features/textures/textures-command.ts'

let dir = ''
afterEach(() => {
  if (dir !== '') rmSync(dir, { recursive: true, force: true })
  dir = ''
})
const fresh = (): string => {
  dir = mkdtempSync(join(tmpdir(), 'world-kit-tiles-'))
  return dir
}
// Three swatches are enough to show what the command does: each tile runs the whole photo pipeline, and the byte
// check over every swatch is in swatch-tiles.test.ts.
const all = readKitSwatches()
const some = Object.fromEntries(
  [
    'oakFloor',
    ...Object.keys(all).filter((name) => name !== 'oakFloor' && textureOf(all[name] as TexturedSwatch)),
  ]
    .slice(0, 3)
    .map((name) => [name, all[name] as TexturedSwatch]),
)
const textured = Object.keys(some).length

describe('automata-world-textures', () => {
  it('writes one tile file for each textured swatch, and every declared read passes', () => {
    const out = fresh()
    const result = runTextures(['--out', out], some)
    expect(result.code).toBe(0)
    expect(readdirSync(out)).toHaveLength(textured)
    expect(result.stdout).toContain('ok           oakFloor')
  })

  it('--check passes on tiles it just made, and fails, naming the swatch, when one has gone stale', () => {
    const out = fresh()
    runTextures(['--out', out], some)
    expect(runTextures(['--check', '--out', out], some).code).toBe(0)
    const file = join(out, 'oakFloor.tile.json')
    const tile = JSON.parse(readFileSync(file, 'utf8'))
    writeFileSync(file, JSON.stringify({ ...tile, sha256: '0'.repeat(64) }))
    const result = runTextures(['--check', '--out', out], some)
    expect(result.code).toBe(1)
    expect(result.stdout).toContain(
      'The texture of "oakFloor" is older than its photo. Run automata-world-textures to update it.',
    )
  })

  it('--check writes nothing', () => {
    const out = fresh()
    runTextures(['--check', '--out', out], some)
    expect(readdirSync(out)).toEqual([])
  })

  it('fails a swatch whose tile does not read as the finish it declares', () => {
    const swatches = { ...some }
    swatches.oakFloor = { ...(swatches.oakFloor as TexturedSwatch), reads: { maxDominant: 0.01 } }
    const result = runTextures(['--out', fresh()], swatches)
    expect(result.code).toBe(1)
    expect(result.stdout).toMatch(/fails\s+oakFloor: flat \d\.\d{3} > 0\.01/)
  })

  it('says what it takes when asked for something it does not do', () => {
    expect(runTextures(['--fast'])).toMatchObject({
      code: 2,
      stderr: expect.stringContaining('does not know --fast'),
    })
    expect(runTextures(['--out'])).toMatchObject({
      code: 2,
      stderr: expect.stringContaining('--out needs a folder'),
    })
    expect(runTextures(['--check', '--out', '/nope/not-here'])).toMatchObject({
      code: 2,
      stderr: expect.stringContaining('There is no folder'),
    })
  })
})
