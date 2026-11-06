import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { Effect, Either } from 'effect'
import { describe, expect, it } from 'vitest'
import { decodePng, encodePng, type Rgba } from '#src/assets/atlas-image.ts'
import { buildAtlases } from '#src/assets/build-atlases.ts'
import type { Diagnostic } from '#src/diagnostics/diagnostic.ts'

// The atlas build (M5 spec §4.7, §6): `content/atlases.toml` names each atlas's folder of PNG frames; the build
// packs them into `<atlas>-<page>.png` and Pixi's `<atlas>-<page>.json`, the same bytes every time (G-c), and
// refuses broken or off-palette frames with a diagnostic each (G-d).

const RED = [255, 0, 64, 255]
const BLACK = [0, 0, 0, 255]

function solid(width: number, height: number, rgba: readonly number[]): Uint8Array {
  const data = new Uint8Array(width * height * 4)
  for (let index = 0; index < data.length; index += 4) data.set(rgba, index)
  return encodePng({ width, height, data })
}

/** A temp project with `content/atlases.toml` (when given) and the files named, relative to the root. */
function project(atlases: string | undefined, files: Readonly<Record<string, Uint8Array | string>>): string {
  const root = mkdtempSync(join(tmpdir(), 'atlas-project-'))
  mkdirSync(join(root, 'content'), { recursive: true })
  if (atlases !== undefined) writeFileSync(join(root, 'content/atlases.toml'), atlases)
  for (const [path, bytes] of Object.entries(files)) {
    mkdirSync(join(root, path, '..'), { recursive: true })
    writeFileSync(join(root, path), bytes)
  }
  return root
}

const WICK = '[atlas.wick]\nframes = "art/wick"\n'
const TWO_FRAMES = { 'art/wick/run-b.png': solid(4, 4, RED), 'art/wick/run-a.png': solid(2, 3, BLACK) }

const build = (root: string) => Effect.runPromise(Effect.either(buildAtlases(root)))

async function built(root: string): Promise<ReadonlyMap<string, Uint8Array>> {
  const result = await build(root)
  if (Either.isLeft(result)) throw new Error(JSON.stringify(result.left))
  return result.right.files
}

async function refused(root: string): Promise<readonly Diagnostic[]> {
  const result = await build(root)
  if (Either.isRight(result)) throw new Error('expected the build to fail')
  return result.left.diagnostics
}

describe('buildAtlases', () => {
  it('packs a folder of frames into a page image and its Spritesheet data', async () => {
    const files = await built(project(WICK, TWO_FRAMES))
    expect([...files.keys()]).toEqual(['wick-0.json', 'wick-0.png'])
    const sheet = JSON.parse(new TextDecoder().decode(files.get('wick-0.json')))
    expect(Object.keys(sheet.frames)).toEqual(['run-a', 'run-b'])
    expect(sheet.meta.image).toBe('wick-0.png')
    const page: Rgba = decodePng(files.get('wick-0.png')!)
    expect(page.width).toBe(sheet.meta.size.w)
  })

  it('gives the same bytes on every build (G-c)', async () => {
    const first = await built(project(WICK, TWO_FRAMES))
    const second = await built(project(WICK, TWO_FRAMES))
    expect(second).toEqual(first)
  })

  it('refuses a .png that is not a PNG, naming it', async () => {
    const diagnostics = await refused(project(WICK, { ...TWO_FRAMES, 'art/wick/broken.png': 'not a png' }))
    expect(diagnostics).toEqual([
      expect.objectContaining({ code: 'invalidAsset', file: 'art/wick/broken.png' }),
    ])
  })

  it('refuses an off-palette pixel when the game declares a palette, naming the pixel and colour (G-d)', async () => {
    const stray = encodePng({ width: 2, height: 1, data: new Uint8Array([...RED, 18, 52, 86, 255]) })
    const diagnostics = await refused(
      project(WICK, {
        'content/palette.toml': 'name = "two"\ncolors = ["#000000", "#ff0040"]\n',
        'art/wick/run-a.png': solid(2, 2, BLACK),
        'art/wick/stray.png': stray,
      }),
    )
    expect(diagnostics).toHaveLength(1)
    expect(diagnostics[0]).toMatchObject({ code: 'offPalette', file: 'art/wick/stray.png' })
    expect(diagnostics[0]?.message).toContain('1,0')
    expect(diagnostics[0]?.message).toContain('#123456')
  })

  it('reports a refused frame alone, even when it is the only one', async () => {
    const diagnostics = await refused(project(WICK, { 'art/wick/broken.png': 'not a png' }))
    expect(diagnostics.map((diagnostic) => diagnostic.code)).toEqual(['invalidAsset'])
  })

  it('checks no colours when the game declares no palette', async () => {
    const stray = encodePng({ width: 1, height: 1, data: new Uint8Array([18, 52, 86, 255]) })
    expect([...(await built(project(WICK, { 'art/wick/stray.png': stray }))).keys()]).toEqual([
      'wick-0.json',
      'wick-0.png',
    ])
  })

  it('refuses an unknown key in atlases.toml with the TOML diagnostics', async () => {
    const diagnostics = await refused(project('[atlas.wick]\nframes = "art/wick"\nscale = 2\n', TWO_FRAMES))
    expect(diagnostics).toEqual([
      expect.objectContaining({ code: 'unknownField', file: 'content/atlases.toml', line: 3 }),
    ])
  })

  it('refuses an atlas whose folder has no frames', async () => {
    const diagnostics = await refused(project('[atlas.wick]\nframes = "art/none"\n', {}))
    expect(diagnostics).toEqual([
      expect.objectContaining({
        code: 'missingAsset',
        file: 'content/atlases.toml',
        keyPath: 'atlas.wick.frames',
      }),
    ])
  })

  it('builds nothing when there is no atlases.toml', async () => {
    expect((await built(project(undefined, TWO_FRAMES))).size).toBe(0)
  })
})
