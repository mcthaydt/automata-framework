import { mkdtempSync, readdirSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { entitiesOf, levelContentSchema } from '@automata/content/level-2d'
import { editorRows, loadEditorList } from '@automata/editor/editor-list'
import { Effect } from 'effect'
import { parse } from 'smol-toml'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { createGame } from '#src/shared/create-game/create-game.ts'
import {
  readStoryContent,
  TEMPLATE_STORY_CONTENT_PATHS,
} from '#src/shared/create-game/template-story-content.ts'
import { templateContentDrift } from '../../../../scripts/write-template-content.ts'

// A new 2D game made where the story's packages are: the square, and a keeper to talk to, a cutscene and a guard, so that
// Writer, Sequence and Schematic each have something of the game's to change. Where the packages are not (a published
// install), `create-game` writes the plain game, and nothing in it asks for a private package.

const ROOT = new URL('../../../../../../', import.meta.url)
const dirs: string[] = []
afterAll(() => {
  for (const dir of dirs) rmSync(dir, { recursive: true, force: true })
})

async function make(
  story: boolean,
): Promise<{ dir: string; files: string[]; read: (path: string) => string }> {
  const base = mkdtempSync(join(tmpdir(), 'af-template-story-'))
  dirs.push(base)
  const dir = join(base, 'game')
  await Effect.runPromise(createGame({ targetDir: dir, id: 'story-game', title: 'Story Game', story }))
  const files = readdirSync(dir, { recursive: true, withFileTypes: true })
    .filter((entry) => entry.isFile())
    .map((entry) => join(entry.parentPath, entry.name).slice(dir.length + 1))
    .sort()
  return { dir, files, read: (path) => readFileSync(join(dir, path), 'utf8') }
}

/** Every workspace package's name, and whether it is private. */
function workspacePackages(): Map<string, boolean> {
  const found = new Map<string, boolean>()
  for (const folder of ['packages', 'extensions']) {
    const parent = new URL(`${folder}/`, ROOT)
    for (const entry of readdirSync(parent, { withFileTypes: true })) {
      if (!entry.isDirectory()) continue
      try {
        const manifest = JSON.parse(readFileSync(new URL(`${entry.name}/package.json`, parent), 'utf8')) as {
          name?: string
          private?: boolean
        }
        if (manifest.name !== undefined) found.set(manifest.name, manifest.private === true)
      } catch {
        // A folder without a manifest is not a package.
      }
    }
  }
  return found
}

describe('the story’s content', () => {
  it('is the 2D story example’s, file for file, so the example’s journeys play what a new game has', () => {
    for (const path of TEMPLATE_STORY_CONTENT_PATHS)
      expect(readStoryContent(path), path).toBe(
        readFileSync(new URL(`examples/2d-story/content/${path}`, ROOT), 'utf8'),
      )
  })

  it('has game files equal to a fresh export of its level project', () => {
    expect(templateContentDrift()).toEqual([])
  })

  it('adds Writer’s and Sequence’s rows to the list, as the editors themselves would', () => {
    const rows = readStoryContent('editors-story.toml')
    expect(rows).toContain(editorRows('writer'))
    expect(rows).toContain(editorRows('sequence'))
  })
})

describe('a new 2D game with the story', () => {
  let game: Awaited<ReturnType<typeof make>>
  beforeAll(async () => {
    game = await make(true)
  })

  it('says who bumped, as the plain game does, so Feel can squash the hero and show a word over it', () => {
    expect(game.read('src/features/square/bumped.event.ts')).toContain('entity: z.number().int()')
    expect(game.read('src/features/square/move.system.ts')).toContain(
      'ctx.emit(Bumped, { entity: square.sid })',
    )
  })

  it('keeps the story in its own feature, beside the square and the level', () => {
    expect(game.files.filter((file) => file.startsWith('src/features/story/'))).toEqual([
      'src/features/story/story-content.ts',
      'src/features/story/story.extensions.ts',
      'src/features/story/story.plugin.ts',
      'src/features/story/story.resource.ts',
      'src/features/story/story.system.ts',
    ])
    expect(game.files).toEqual(
      expect.arrayContaining([
        'src/app/story-camera.ts',
        'src/app/story-sim.ts',
        'src/features/square/hero.component.ts',
        'src/features/level/level-content.ts',
        'src/features/level/level-items.ts',
      ]),
    )
  })

  it('has what each content editor changes: the keeper’s words, the cutscene, the guard and where he walks', () => {
    expect(
      game.files.filter((file) => /^content\/(lines|dialogue|cutscenes|systems|nav|words)\//.test(file)),
    ).toEqual([
      'content/cutscenes/gate.toml',
      'content/dialogue/keeper.toml',
      'content/lines/keeper.toml',
      'content/nav/guard.toml',
      'content/systems/guard.toml',
      'content/words/en.json',
    ])
  })

  it('places a keeper and a guard in the level, by name', () => {
    const level = levelContentSchema.parse(parse(game.read('content/levels/start.toml')))
    const defs = entitiesOf(level, 'entities').map((item) => item.def)
    expect(defs).toEqual(expect.arrayContaining(['player-start', 'keeper', 'guard']))
  })

  it('lists every editor the game plays, with the rows the editors themselves would add', () => {
    const list = game.read('content/editors.toml')
    expect(loadEditorList(list).ok).toBe(true)
    const rows = (parse(list) as { file: { glob: string; editor: string }[] }).file
    for (const id of ['tuner', 'feel', 'audio', 'writer', 'sequence', 'schematic']) {
      const wanted = (editorRows(id)?.match(/glob = "([^"]+)"/g) ?? []).map((line) => line.slice(8, -1))
      expect(wanted.length, id).toBeGreaterThan(0)
      for (const glob of wanted)
        expect(
          rows.some((row) => row.glob === glob && row.editor === id),
          `${id} ${glob}`,
        ).toBe(true)
    }
  })

  it('asks for the packages the story plays on, in the version that made the game', () => {
    const { dependencies } = JSON.parse(game.read('package.json')) as { dependencies: Record<string, string> }
    for (const name of ['narrative', 'cutscenes', 'systems', 'nav', 'puzzle', 'level-2d'])
      expect(dependencies[`@automata/${name}`], name).toBe(dependencies['@automata/framework'])
  })

  it('compiles the keeper’s words, the cutscene and the guard with the content plugin', () => {
    const config = game.read('vite.config.ts')
    for (const kind of [
      'linesContent',
      'dialogueContent',
      'cutsceneContent',
      'navGraphContent',
      'systemsContent',
    ])
      expect(config).toContain(kind)
  })

  it('plays the story as the game’s extensions and sim plugins, and reads the speed from the tuning', () => {
    const play = game.read('src/app/game.ts')
    expect(play).toContain('extensions: EXTENSIONS')
    expect(play).toContain('plugins: PLUGINS')
    expect(game.read('src/features/square/move.system.ts')).toContain('tuning.SPEED')
    expect(game.read('src/features/square/move.system.ts')).toContain('frozen')
  })

  it('says in the story’s code which part is code and which is content', () => {
    expect(game.read('src/features/story/story.system.ts')).toMatch(/stays code/)
  })

  it('keeps the sim free of the renderer, so its tests need no browser', () => {
    for (const file of game.files.filter((each) =>
      /^src\/features\/(square|level|story)\/(?!\w+\.view|level-scene)/.test(each),
    ))
      expect(game.read(file), file).not.toMatch(/from '@automata\/framework'|pixi/)
  })

  it('has a test that walks up to the keeper and starts the conversation', () => {
    expect(game.files).toContain('tests/unit/story/story-run.test.ts')
    expect(game.read('tests/unit/story/story-run.test.ts')).toContain('starts the keeper')
  })
})

describe('a new 2D game without the story', () => {
  let game: Awaited<ReturnType<typeof make>>
  beforeAll(async () => {
    game = await make(false)
  })

  it('has none of the story’s files', () => {
    expect(
      game.files.filter((file) =>
        /story|hero\.component|level-content|level-items|content\/(lines|dialogue|cutscenes|systems|nav|words)\//.test(
          file,
        ),
      ),
    ).toEqual([])
  })

  it('lists what it plays, and not Writer or Sequence', () => {
    const rows = (parse(game.read('content/editors.toml')) as { file: { editor: string }[] }).file
    const editors = new Set(rows.map((row) => row.editor))
    expect([...editors].sort()).toEqual(['audio', 'feel', 'levels-2d', 'schematic', 'tuner'])
  })

  it('asks for no package that is private, so it installs from the registry', () => {
    const manifest = JSON.parse(game.read('package.json')) as {
      dependencies: Record<string, string>
      devDependencies: Record<string, string>
    }
    const workspace = workspacePackages()
    const asked = Object.keys({ ...manifest.dependencies, ...manifest.devDependencies }).filter((name) =>
      name.startsWith('@automata/'),
    )
    expect(asked.length).toBeGreaterThan(0)
    expect(asked.filter((name) => workspace.get(name) === true)).toEqual([])
  })
})
