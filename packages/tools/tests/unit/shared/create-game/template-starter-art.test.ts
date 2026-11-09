import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { projectContentSchema } from '@automata/content/level-2d'
import { Effect } from 'effect'
import { parse } from 'smol-toml'
import { afterAll, describe, expect, it } from 'vitest'
import { createGame } from '#src/shared/create-game/create-game.ts'
import { templateFilesOf } from '#src/shared/create-game/template.ts'
import { readTemplateContent } from '#src/shared/create-game/template-content.ts'
import { FilesLive } from '#src/shared/node/files.ts'
import { starterArtDrift } from '../../../../scripts/write-starter-art.ts'

// A new game starts with pictures, not boxes: a terrain sheet the level's ground is cut from, and a strip of frames each
// for the player, a coin and a slime. They are made by `scripts/write-starter-art.ts`, so a test regenerates them and
// compares. The player's frame is the size of the player start, so what is drawn is what collides.

const made: string[] = []
afterAll(() => {
  for (const dir of made) rmSync(dir, { recursive: true, force: true })
})

const SHEETS = [
  { path: 'assets/terrain.png', width: 128, height: 128 },
  { path: 'assets/player.png', width: 32, height: 24 },
  { path: 'assets/coin.png', width: 32, height: 8 },
  { path: 'assets/slime.png', width: 32, height: 12 },
] as const

const sizeOf = (png: Buffer): { width: number; height: number } => ({
  width: png.readUInt32BE(16),
  height: png.readUInt32BE(20),
})

const project = () => projectContentSchema.parse(parse(readTemplateContent('project.toml')))

describe('the starter pictures', () => {
  it('are equal to a fresh run of the script that makes them', () => {
    expect(starterArtDrift()).toEqual([])
  })

  it.each(SHEETS)('$path is a PNG of $width x $height', ({ path, width, height }) => {
    const png = readFileSync(
      new URL(`../../../../src/shared/create-game/template-content/${path}`, import.meta.url),
    )
    expect([...png.subarray(0, 8)]).toEqual([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
    expect(sizeOf(png)).toEqual({ width, height })
  })

  it('are named by the project: the terrain by its tileset, the rest by their characters', () => {
    const { tilesets, entities } = project()
    expect(tilesets.find((each) => each.id === 'terrain')).toMatchObject({
      image: 'assets/terrain.png',
      placeholder: false,
    })
    for (const [id, path] of [
      ['player-start', 'assets/player.png'],
      ['coin', 'assets/coin.png'],
      ['slime', 'assets/slime.png'],
    ] as const) {
      const entity = entities.find((each) => each.id === id)
      expect(entity?.animation?.image, id).toBe(path)
      // The frame is the character's own box: what is drawn is what collides.
      expect(entity?.animation?.frame, id).toEqual(entity?.size)
    }
  })

  it('cut into frames the character plays, none of them past the sheet', () => {
    for (const { id, columns } of [
      { id: 'player-start', columns: 2 },
      { id: 'coin', columns: 4 },
      { id: 'slime', columns: 2 },
    ]) {
      const animation = project().entities.find((each) => each.id === id)?.animation
      for (const clip of animation?.clips ?? []) expect(Math.max(...clip.frames), id).toBeLessThan(columns)
    }
  })

  it('belong to the plain game only: the story game names its own pictures', () => {
    const plain = templateFilesOf({ id: 'g', title: 'G' }).map((file) => file.path)
    const story = templateFilesOf({ id: 'g', title: 'G', story: true }).map((file) => file.path)
    for (const { path } of SHEETS) {
      expect(plain).toContain(path)
      expect(story).not.toContain(path)
    }
  })

  it('are written into a new game byte for byte, where the game and the editors look for them', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'starter-art-'))
    made.push(dir)
    const target = join(dir, 'coin-run')
    await Effect.runPromise(
      createGame({ id: 'coin-run', title: 'Coin Run', targetDir: target, story: false }).pipe(
        Effect.provide(FilesLive),
      ),
    )
    for (const { path } of SHEETS) {
      expect(existsSync(join(target, path)), path).toBe(true)
      expect(
        readFileSync(join(target, path)).equals(
          readFileSync(
            new URL(`../../../../src/shared/create-game/template-content/${path}`, import.meta.url),
          ),
        ),
        path,
      ).toBe(true)
    }
  })
})
