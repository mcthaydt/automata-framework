import { mkdtempSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import {
  type ContentLevel,
  type ContentProject,
  type ContentWorld,
  levelContentSchema,
  projectContentSchema,
  worldContentSchema,
} from '@automata/content/level-2d'
import { type ExportFile, exportContent } from '@automata/editor/level-export'
import { newProject } from '@automata/editor/level-templates'
import { Effect } from 'effect'
import { parse } from 'smol-toml'
import { afterAll, describe, expect, it } from 'vitest'
import { createGame } from '#src/shared/create-game/create-game.ts'
import { readTemplateContent } from '#src/shared/create-game/template-content.ts'

// What a visitor does on the site: makes a level in Try the editor, downloads it and opens it in their own game. The
// editor then saves the level under its own name and rewrites the project and the world, and the game must still play
// it. The game's level code is generated text, so the test writes a game and loads that text.

interface LevelCode {
  startLevelId(world: ContentWorld, levels: Readonly<Record<string, ContentLevel>>): string
  liveCharacters(project: ContentProject): readonly string[]
  levelOf(level: ContentLevel): { readonly start: { readonly x: number; readonly y: number } }
}

const made: string[] = []
afterAll(() => {
  for (const dir of made) rmSync(dir, { recursive: true, force: true })
})

/** The level code `create-game` writes, loaded from a game folder inside this package so `@automata/*` resolves. */
async function levelCode(): Promise<LevelCode> {
  const dir = mkdtempSync(join(process.cwd(), 'scratch-try-it-'))
  made.push(dir)
  const game = join(dir, 'game')
  await Effect.runPromise(createGame({ targetDir: game, id: 'try-game', title: 'Try Game' }))
  return (await import(join(game, 'src/features/level/read-level.ts'))) as LevelCode
}

const contentOf = (files: readonly ExportFile[], path: string): unknown => {
  const found = files.find((file) => file.path === path)
  if (found === undefined) throw new Error(`The export has no ${path}.`)
  return parse(found.contents)
}

const starterLevel = (): ContentLevel =>
  levelContentSchema.parse(parse(readTemplateContent('levels/start.toml')))

describe('a level made in Try the editor, opened in a new game', () => {
  it('is the level the game plays, whatever its id', async () => {
    const code = await levelCode()
    const files = exportContent(newProject('platformer'))
    const tryIt = levelContentSchema.parse(contentOf(files, 'levels/level-1.toml'))
    const world = worldContentSchema.parse(contentOf(files, 'world.toml'))
    // The starter's own level stays in the folder, as it does when the editor saves beside it.
    expect(code.startLevelId(world, { start: starterLevel(), 'level-1': tryIt })).toBe('level-1')
    expect(code.levelOf(tryIt).start).toEqual({ x: 48, y: 256 })
  })

  it('plays the starter level while the world is the starter world', async () => {
    const code = await levelCode()
    const world = worldContentSchema.parse(parse(readTemplateContent('world.toml')))
    expect(code.startLevelId(world, { start: starterLevel() })).toBe('start')
  })

  it('says so when the world places no level the game has', async () => {
    const code = await levelCode()
    const world = worldContentSchema.parse(parse(readTemplateContent('world.toml')))
    expect(() => code.startLevelId(world, {})).toThrow(/no level/i)
  })

  it('draws itself the characters it has, and only those', async () => {
    const code = await levelCode()
    const tryIt = projectContentSchema.parse(
      contentOf(exportContent(newProject('platformer')), 'project.toml'),
    )
    const starter = projectContentSchema.parse(parse(readTemplateContent('project.toml')))
    expect(tryIt.entities.some((def) => def.id === 'area')).toBe(false)
    expect(code.liveCharacters(tryIt)).toEqual(['player-start'])
    expect(code.liveCharacters(starter)).toEqual(['player-start', 'area'])
  })
})
