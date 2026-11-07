import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { Effect, Either } from 'effect'
import { describe, expect, it } from 'vitest'
import { z } from 'zod'
import {
  type CompiledContent,
  type ContentOptions,
  compileContent,
} from '#src/shared/compile/compile-content.ts'
import { formatDiagnostic } from '#src/shared/diagnostics/diagnostic.ts'
import { defineContentGenerator } from '#src/shared/generate/content-generator.ts'
import { canonicalFile } from '#src/shared/hash/canonical-file.ts'
import { contentHash } from '#src/shared/hash/content-hash.ts'
import { defineContentSchema, localized } from '#src/shared/schema/content-schema.ts'
import { CHARACTER, copyFixture, fixtureOptions, SONG, TUNABLE_DEFAULTS } from '#src/testing/fixture-game.ts'

const compile = (options: ContentOptions) => Effect.runPromise(Effect.either(compileContent(options)))

async function compiled(options: ContentOptions): Promise<CompiledContent> {
  const result = await compile(options)
  if (Either.isLeft(result)) throw new Error(JSON.stringify(result.left, null, 2))
  return result.right
}

/** Every formatted diagnostic of a compile that must fail. */
async function refusals(options: ContentOptions): Promise<string[]> {
  const result = await compile(options)
  if (Either.isRight(result)) throw new Error('expected the compile to fail')
  if (result.left._tag !== 'ContentCompileFailed') throw new Error(result.left.message)
  return result.left.diagnostics.map(formatDiagnostic)
}

async function configError(options: ContentOptions): Promise<string> {
  const result = await compile(options)
  if (Either.isRight(result) || result.left._tag !== 'InvalidContentConfig') {
    throw new Error('expected InvalidContentConfig')
  }
  return result.left.message
}

const edit = (root: string, file: string, change: (text: string) => string): void => {
  const path = join(root, 'content', file)
  writeFileSync(path, change(readFileSync(path, 'utf8')))
}

/** False on a case-insensitive filesystem (macOS APFS by default), where two names differing only in case collide. */
function caseSensitiveFs(): boolean {
  const probe = mkdtempSync(join(tmpdir(), 'content-case-'))
  try {
    writeFileSync(join(probe, 'a'), '')
    return !existsSync(join(probe, 'A'))
  } finally {
    rmSync(probe, { recursive: true, force: true })
  }
}

describe('the fixture game', () => {
  it('compiles FloorFifty’s real flow and tuning with its declarations', async () => {
    const { data } = await compiled(fixtureOptions(copyFixture('valid')))
    expect(Object.keys(data).sort()).toEqual([
      'assets',
      'catalog',
      'character',
      'flow',
      'game',
      'palette',
      'song',
      'stage',
      'tuning',
    ])
    expect(data.tuning).toEqual(TUNABLE_DEFAULTS)
    expect((data.flow as { entry: string }).entry).toBe('Splash')
    expect(Object.keys(data.song as object)).toEqual(['dawn-tutorial', 'dusk-run'])
    // References and localized text are plain strings once checked.
    expect((data.stage as Record<string, { song: unknown }>).rooftops?.song).toBe('dusk-run')
    expect((data.character as Record<string, { displayName: unknown }>).cyan?.displayName).toBe('Cyan')
    expect((data.palette as { name: string }).name).toBe('Endesga 64')
  })

  it('hashes the canonical data and writes every derived file', async () => {
    const { data, hash, files } = await compiled(fixtureOptions(copyFixture('valid')))
    expect(hash).toBe(contentHash(data))
    expect([...files.keys()].sort()).toEqual([
      'content.d.ts',
      'content.hash',
      'content.json',
      'flow.mmd',
      'messages/en.json',
      'outputs.txt',
      'ruken-fields.json',
      'sim-content.hash',
      'sim-content.json',
      'tuning-meta.json',
    ])
    expect(files.get('outputs.txt')).toBe(
      'content.d.ts\ncontent.hash\ncontent.json\nflow.mmd\nmessages/en.json\nruken-fields.json\nsim-content.hash\nsim-content.json\ntuning-meta.json\n',
    )
    expect(files.get('content.json')).toBe(canonicalFile(data))
    expect(files.get('content.hash')).toBe(`${hash}\n`)
    expect(files.get('messages/en.json')).toContain('"content_stage_rooftops_display_name": "Rooftops"')
    expect(files.get('content.d.ts')).toContain("export type StageId = 'dawn' | 'rooftops'")
    expect(JSON.parse(files.get('ruken-fields.json') ?? '')).toEqual({
      content: { languages: ['en', 'fr'], rating: 'everyone', descriptors: [], estimated_hours: 1.5 },
      analytics: { custom_events: ['race_finished', 'tutorial_complete'] },
    })
    expect(JSON.parse(files.get('tuning-meta.json') ?? '').GRAVITY).toEqual({
      type: 'float',
      value: -275,
      min: -1200,
      max: -100,
    })
    expect(files.get('flow.mmd')).toMatch(/^stateDiagram-v2\n/)
  })

  it('keeps each language’s catalog, source first, outside the hashed data', async () => {
    const root = copyFixture('valid')
    const before = await compiled(fixtureOptions(root))
    expect(before.languages).toEqual(['en', 'fr'])
    expect([...before.catalogs.keys()]).toEqual(['en', 'fr'])
    expect(before.catalogs.get('en')?.content_stage_dawn_display_name).toBe('Dawn')
    expect(before.catalogs.get('fr')?.content_stage_dawn_display_name).toBe('Aube')
    expect(before.catalogs.get('fr')).not.toHaveProperty('$schema')
    // The sim stores keys, never strings: a translation edit moves neither hash (PRODUCT spec §4 item 5).
    edit(root, 'messages/fr.json', (text) => text.replace('"Aube"', '"Aurore"'))
    const after = await compiled(fixtureOptions(root))
    expect(after.catalogs.get('fr')?.content_stage_dawn_display_name).toBe('Aurore')
    expect(after.hash).toBe(before.hash)
    expect(after.sim.hash).toBe(before.sim.hash)
  })

  it('says where each language’s message is written, for the glyph gate (M5.5)', async () => {
    const { messageLocations } = await compiled(fixtureOptions(copyFixture('valid')))
    expect([...messageLocations.keys()]).toEqual(['en', 'fr'])
    expect(messageLocations.get('en')?.get('content_stage_dawn_display_name')).toEqual({
      file: 'content/stages/dawn.toml',
      line: 2,
      column: 1,
    })
    expect(messageLocations.get('fr')?.get('content_stage_dawn_display_name')).toEqual({
      file: 'content/messages/fr.json',
      line: 10,
      column: 3,
    })
  })

  it('gives nested files path IDs', async () => {
    const root = copyFixture('valid')
    mkdirSync(join(root, 'content/songs/night'))
    writeFileSync(
      join(root, 'content/songs/night/dusk.toml'),
      readFileSync(join(root, 'content/songs/dusk-run.toml')),
    )
    edit(root, 'stages/rooftops.toml', (text) => text.replace('song = "dusk-run"', 'song = "night/dusk"'))
    edit(root, 'messages/fr.json', (text) =>
      text.replace('{\n', '{\n  "content_song_night_dusk_display_name": "Crépuscule",\n'),
    )
    const { data } = await compiled(fixtureOptions(root))
    expect(Object.keys(data.song as object)).toEqual(['dawn-tutorial', 'dusk-run', 'night/dusk'])
  })
})

// Audit of PR #8: a song saved as dusk-run.TOML vanished from the game without a word.
describe('files the compiler skips', () => {
  it('are reported as warnings, and change nothing else', async () => {
    const clean = await compiled(fixtureOptions(copyFixture('valid')))
    expect(clean.warnings).toEqual([])

    const root = copyFixture('valid')
    writeFileSync(join(root, 'content/songs/night-run.TOML'), 'title = "x"\n')
    writeFileSync(join(root, 'content/songs/notes.md'), 'ideas\n')
    writeFileSync(join(root, 'content/songs/.DS_Store'), '')
    writeFileSync(join(root, 'content/messages/de.JSON'), '{}\n')
    const { warnings, hash, files } = await compiled(fixtureOptions(root))
    expect(warnings.map(formatDiagnostic)).toEqual([
      'content/messages/de.JSON:1:1  skippedFile: this file is not read; translations are named like fr.json',
      'content/songs/night-run.TOML:1:1  skippedFile: this file is not read; items are named like dusk-run.toml',
      'content/songs/notes.md:1:1  skippedFile: this file is not read; items are named like dusk-run.toml',
    ])
    expect(hash).toBe(clean.hash)
    expect(files).toEqual(clean.files)
  })

  it('warns about a near miss of a document name at the top of content/, and not about other files', async () => {
    const root = copyFixture('valid')
    // `Game.toml` is a case-only near miss of the fixture's `game.toml`; on a case-insensitive filesystem the two
    // are one file, so that case can only be exercised where the filesystem can hold both.
    const caseSensitive = caseSensitiveFs()
    if (caseSensitive) writeFileSync(join(root, 'content/Game.toml'), '')
    writeFileSync(join(root, 'content/tunning.toml'), 'GRAVITY = 1\n')
    writeFileSync(join(root, 'content/flow.toml.bak'), '')
    writeFileSync(join(root, 'content/README.md'), 'notes\n')
    // Near in name but not TOML, so never a misnamed document (audit of PR #8).
    writeFileSync(join(root, 'content/log.txt'), '')
    writeFileSync(join(root, 'content/game.md'), '')
    const { warnings } = await compiled(fixtureOptions(root))
    const expected = [
      'content/flow.toml.bak:1:1  skippedFile: this file is not read; did you mean flow.toml?',
      'content/tunning.toml:1:1  skippedFile: this file is not read; did you mean tuning.toml?',
    ]
    if (caseSensitive) {
      expected.unshift('content/Game.toml:1:1  skippedFile: this file is not read; did you mean game.toml?')
    }
    expect(warnings.map(formatDiagnostic)).toEqual(expected)
  })
})

// Audit of PR #8: `messages/FR_fr.json` and `messages/notes.json` became languages in ruken-fields.json.
describe('translation file names', () => {
  it('must be language tags', async () => {
    const root = copyFixture('valid')
    writeFileSync(join(root, 'content/messages/FR_fr.json'), '{}\n')
    writeFileSync(join(root, 'content/messages/notes.json'), '{}\n')
    writeFileSync(join(root, 'content/messages/__proto__.json'), '{}\n')
    expect(await refusals(fixtureOptions(root))).toEqual([
      'content/messages/FR_fr.json:1:1  invalidId: FR_fr is not a language tag; name translations like fr.json or pt-BR.json',
      'content/messages/__proto__.json:1:1  invalidId: __proto__ is not a language tag; name translations like fr.json or pt-BR.json',
      'content/messages/notes.json:1:1  invalidId: notes is not a language tag; name translations like fr.json or pt-BR.json',
    ])
  })
})

// Audit of PR #8: a byte order mark made translation JSON invalid and moved TOML line-1 columns by one.
describe('a UTF-8 byte order mark', () => {
  it('is ignored in TOML and translation JSON', async () => {
    const clean = await compiled(fixtureOptions(copyFixture('valid')))
    const root = copyFixture('valid')
    edit(root, 'messages/fr.json', (text) => `\uFEFF${text}`)
    edit(root, 'tuning.toml', (text) => `\uFEFF${text}`)
    expect((await compiled(fixtureOptions(root))).hash).toBe(clean.hash)

    edit(root, 'songs/dusk-run.toml', (text) => `\uFEFFtempoDrift = 3\n${text}`)
    expect(await refusals(fixtureOptions(root))).toEqual([
      'content/songs/dusk-run.toml:1:1  tempoDrift  unknownField: unknown field: tempoDrift',
    ])
  })
})

describe('equivalent trees', () => {
  it('give byte-identical outputs', async () => {
    const options = (root: string): ContentOptions => ({ root, schemas: [CHARACTER, SONG] })
    const a = await compiled(options(copyFixture('equivalent-a')))
    const b = await compiled(options(copyFixture('equivalent-b')))
    expect([...b.files.entries()]).toEqual([...a.files.entries()])
  })
})

describe('the hash', () => {
  it.each([
    ['a song value', 'songs/dusk-run.toml', (t: string) => t.replace('bpm = 128.0', 'bpm = 129.0')],
    ['a localized name', 'characters/cyan.toml', (t: string) => t.replace('"Cyan"', '"Cyan!"')],
    ['a tunable', 'tuning.toml', (t: string) => t.replace('GRAVITY = -275.0', 'GRAVITY = -276.0')],
    ['a flow style', 'flow.toml', (t: string) => t.replace('transition = "liquid"', 'transition = "cut"')],
    ['a game fact', 'game.toml', (t: string) => t.replace('1.5', '2')],
  ])('moves when %s changes', async (_case, file, change) => {
    const before = await compiled(fixtureOptions(copyFixture('valid')))
    const root = copyFixture('valid')
    edit(root, file, change)
    expect((await compiled(fixtureOptions(root))).hash).not.toBe(before.hash)
  })

  it('moves when a palette is authored', async () => {
    const before = await compiled(fixtureOptions(copyFixture('valid')))
    const root = copyFixture('valid')
    writeFileSync(join(root, 'content/palette.toml'), 'name = "Two"\ncolors = ["#000000", "#ffffff"]\n')
    expect((await compiled(fixtureOptions(root))).hash).not.toBe(before.hash)
  })
})

describe('refusals (one formatted line per failure policy row)', () => {
  const broken = async (file: string, change: (text: string) => string): Promise<string[]> => {
    const root = copyFixture('valid')
    edit(root, file, change)
    return refusals(fixtureOptions(root))
  }

  it('a TOML syntax error, at smol-toml’s position', async () => {
    const lines = await broken('songs/dusk-run.toml', (t) => t.replace('bpm = 128.0', 'bpm = '))
    expect(lines).toEqual(['content/songs/dusk-run.toml:2:7  invalidToml: invalid value'])
  })

  it('an unknown field', async () => {
    expect(await broken('songs/dusk-run.toml', (t) => `${t}tempoDrift = 3\n`)).toEqual([
      'content/songs/dusk-run.toml:8:1  tempoDrift  unknownField: unknown field: tempoDrift',
    ])
  })

  it('a missing field and a wrong type', async () => {
    expect(
      await broken('songs/dusk-run.toml', (t) =>
        t.replace('audioAlias = "music.duskRun"\n', '').replace('bpm = 128.0', 'bpm = "fast"'),
      ),
    ).toEqual([
      'content/songs/dusk-run.toml:1:1  audioAlias  missingField: required',
      'content/songs/dusk-run.toml:2:1  bpm  invalidType: Invalid input: expected number, received string',
    ])
  })

  it('a missing required document', async () => {
    const root = copyFixture('valid')
    rmSync(join(root, 'content/catalog.toml'))
    expect(await refusals(fixtureOptions(root))).toEqual([
      'content/catalog.toml:1:1  missingField: this file is required and could not be read',
    ])
  })

  it('missing tuning when the game declares tunables', async () => {
    const root = copyFixture('valid')
    rmSync(join(root, 'content/tuning.toml'))
    expect(await refusals(fixtureOptions(root))).toEqual([
      'content/tuning.toml:1:1  missingField: this file is required and could not be read',
    ])
  })

  it('a file name that is not an ID', async () => {
    const root = copyFixture('valid')
    writeFileSync(
      join(root, 'content/songs/Dusk.toml'),
      readFileSync(join(root, 'content/songs/dusk-run.toml')),
    )
    expect(await refusals(fixtureOptions(root))).toEqual([
      'content/songs/Dusk.toml:1:1  invalidId: Dusk is not an ID; name files like dusk-run.toml (^[a-z0-9-]+$ per folder)',
    ])
  })

  it('a dangling reference', async () => {
    expect(
      await broken('stages/rooftops.toml', (t) => t.replace('song = "dusk-run"', 'song = "dusk-rnu"')),
    ).toEqual(['content/stages/rooftops.toml:3:1  song  unknownReference: no song has the id dusk-rnu'])
  })

  it('a reference to the wrong kind', async () => {
    expect(
      await broken('catalog.toml', (t) => t.replace('songs = ["dusk-run"]', 'songs = ["cyan"]')),
    ).toEqual(['content/catalog.toml:5:1  packs.0.songs.0  wrongKind: cyan is a character, not a song'])
  })

  it('tuning out of range, and an invariant', async () => {
    expect(
      await broken(
        'tuning.toml',
        (t) => `${t.replace('GRAVITY = -275.0', 'GRAVITY = -2000.0')}TICK_HZ = 60\n`,
      ),
    ).toEqual([
      'content/tuning.toml:20:1  GRAVITY  outOfRange: expected -1200..-100, received -2000',
      'content/tuning.toml:99:1  TICK_HZ  invariantNotAuthorable: TICK_HZ is a code-only invariant and cannot be authored',
    ])
  })

  it('nan or inf in tuning, at its line (audit of PR #8: it used to crash)', async () => {
    expect(await broken('tuning.toml', (t) => t.replace('GRAVITY = -275.0', 'GRAVITY = nan'))).toEqual([
      'content/tuning.toml:20:1  GRAVITY  invalidType: GRAVITY must be a finite number, received nan',
    ])
    expect(await broken('tuning.toml', (t) => t.replace('GRAVITY = -275.0', 'GRAVITY = -inf'))).toEqual([
      'content/tuning.toml:20:1  GRAVITY  invalidType: GRAVITY must be a finite number, received -inf',
    ])
  })

  it('a TOML date, kept as its ISO string', async () => {
    const root = copyFixture('equivalent-a')
    const event = defineContentSchema('event', z.strictObject({ at: z.iso.date() }), { file: 'event.toml' })
    writeFileSync(join(root, 'content/event.toml'), 'at = 2026-01-01\n')
    const { data } = await compiled({ root, schemas: [CHARACTER, SONG, event] })
    expect(data.event).toEqual({ at: '2026-01-01' })
  })

  it('a flow problem', async () => {
    expect(await broken('flow.toml', (t) => t.replace('entry = "Splash"', 'entry = "MainMenu"'))).toContain(
      'content/flow.toml:9:1  entry  invalidFlow: entry must be Splash, received MainMenu',
    )
  })

  it('a palette problem', async () => {
    const root = copyFixture('valid')
    writeFileSync(join(root, 'content/palette.toml'), 'name = "Two"\ncolors = ["#000000", "#000000"]\n')
    expect(await refusals(fixtureOptions(root))).toEqual([
      'content/palette.toml:2:1  colors.1  invalidPalette: color 1 (#000000) repeats color 0',
    ])
  })

  it('a game fact and an asset path', async () => {
    const root = copyFixture('valid')
    edit(root, 'game.toml', (t) => t.replace('"race_finished"', '"Race Finished"'))
    edit(root, 'assets.toml', (t) => t.replace('"audio/*"', '"../secrets"'))
    expect(await refusals(fixtureOptions(root))).toEqual([
      'content/assets.toml:5:1  screens.MainMenu.files.1  invalidGame: Ruken PRELOAD_PATH_INVALID: ../secrets must be a file path inside the build, such as audio/menu.m4a, or a folder path ending in /* such as audio/*.',
      'content/game.toml:5:1  custom_events.0  invalidGame: Ruken CUSTOM_EVENT_INVALID: analytics.custom_events[0] must be lowercase letters, digits and underscores, starting with a letter.',
    ])
  })

  // Audit of PR #8: a game.toml that failed to parse used to hide Ruken's verdict on assets.toml.
  it('an asset path, even while game.toml does not parse', async () => {
    const root = copyFixture('valid')
    writeFileSync(join(root, 'content/game.toml'), 'rating = \n')
    edit(root, 'assets.toml', (t) => t.replace('"audio/*"', '"../secrets"'))
    const lines = await refusals(fixtureOptions(root))
    expect(lines).toContain(
      'content/assets.toml:5:1  screens.MainMenu.files.1  invalidGame: Ruken PRELOAD_PATH_INVALID: ../secrets must be a file path inside the build, such as audio/menu.m4a, or a folder path ending in /* such as audio/*.',
    )
    expect(
      lines.some((line) => line.startsWith('content/game.toml:1:') && line.includes('invalidToml')),
    ).toBe(true)
  })

  it('a stale translation', async () => {
    const root = copyFixture('valid')
    edit(root, 'messages/fr.json', (t) => t.replace('"content_stage_dawn_display_name": "Aube",\n', ''))
    expect(await refusals(fixtureOptions(root))).toEqual([
      'content/stages/dawn.toml:2:1  displayName  staleTranslation: content_stage_dawn_display_name is missing from content/messages/fr.json',
    ])
  })

  // L-d (PRODUCT spec §4): each translation problem carries the line and column an author opens.
  it('an extra key and a non-text value, each at its own key', async () => {
    const root = copyFixture('valid')
    edit(root, 'messages/fr.json', (t) =>
      t
        .replace(
          '"content_catalog_packs_0_title": "Base",',
          '"content_extra": "X",\n  "content_catalog_packs_0_title": "Base",',
        )
        .replace(
          '"content_stage_rooftops_display_name": "Toits"',
          '"content_stage_rooftops_display_name": 7',
        ),
    )
    expect(await refusals(fixtureOptions(root))).toEqual([
      'content/messages/fr.json:3:3  content_extra  staleTranslation: content_extra is not a source key',
      'content/messages/fr.json:12:3  content_stage_rooftops_display_name  staleTranslation: content_stage_rooftops_display_name must be text',
    ])
  })

  it('two texts on one message key', async () => {
    const root = copyFixture('equivalent-a')
    const sign = defineContentSchema(
      'sign',
      z.strictObject({ fullName: localized(), full_name: localized() }),
      {
        file: 'sign.toml',
      },
    )
    writeFileSync(join(root, 'content/sign.toml'), 'fullName = "A"\nfull_name = "B"\n')
    expect(await refusals({ root, schemas: [CHARACTER, SONG, sign] })).toEqual([
      'content/sign.toml:2:1  full_name  duplicateMessageKey: content_sign_full_name is also the key of fullName',
    ])
  })

  it('several broken files at once, every one reported, sorted', async () => {
    const root = copyFixture('valid')
    edit(root, 'stages/rooftops.toml', (t) => t.replace('song = "dusk-run"', 'song = "dusk-rnu"'))
    edit(root, 'songs/dusk-run.toml', (t) => `${t}tempoDrift = 3\n`)
    edit(root, 'characters/cyan.toml', (t) => t.replace('displayName = "Cyan"', 'displayName = '))
    const lines = await refusals(fixtureOptions(root))
    expect(lines.map((line) => line.split('  ')[0])).toEqual([
      expect.stringMatching(/^content\/characters\/cyan\.toml:1:\d+$/),
      'content/songs/dusk-run.toml:8:1',
      'content/stages/rooftops.toml:3:1',
    ])
  })
})

describe('InvalidContentConfig', () => {
  const root = '/nowhere/at/all'

  it('refuses a duplicate or reserved kind before reading anything', async () => {
    const tuning = defineContentSchema('tuning', z.strictObject({}), { file: 'other.toml' })
    expect(await configError({ root, schemas: [SONG, SONG, tuning] })).toBe(
      'kind "song" is registered twice; kind "tuning" is reserved for the built-in tuning.toml',
    )
  })

  it("reports a generator that throws as the game's code, not its content", async () => {
    const boom = defineContentGenerator('boom', () => {
      throw new Error('no luck')
    })
    const options = { ...fixtureOptions(copyFixture('valid')), generators: [boom] }
    expect(await configError(options)).toBe('generator "boom" threw: no luck')
  })

  it("reports a schema that throws as the game's code, naming the file it was reading", async () => {
    const root = copyFixture('equivalent-a')
    const boom = defineContentSchema(
      'boom',
      z.strictObject({
        mood: z.string().transform((mood) => {
          if (mood === 'crash') throw new Error('kaboom')
          return mood
        }),
      }),
      { file: 'boom.toml' },
    )
    writeFileSync(join(root, 'content/boom.toml'), 'mood = "crash"\n')
    expect(await configError({ root, schemas: [CHARACTER, SONG, boom] })).toBe(
      'the schema for boom threw while reading content/boom.toml: kaboom',
    )
  })

  it('refuses two generators with one name', async () => {
    const a = defineContentGenerator('extra', () => ({}))
    expect(await configError({ root, schemas: [], generators: [a, a] })).toBe(
      'generator "extra" is registered twice',
    )
  })

  it('refuses an output folder outside the project', async () => {
    expect(await configError({ root, schemas: [], outDir: '../out' })).toBe(
      'outDir ../out must be a relative folder inside the project',
    )
  })

  it('refuses a generator that writes a built-in file or leaves the output folder', async () => {
    const clash = defineContentGenerator('clash', () => ({ files: { 'content.json': '{}' } }))
    const leaving = defineContentGenerator('escape', () => ({ files: { '../evil.txt': '' } }))
    const options = { ...fixtureOptions(copyFixture('valid')), generators: [clash, leaving] }
    expect(await configError(options)).toBe(
      'generators "artifact" and "clash" both write content.json; generator "escape" writes ../evil.txt, outside the output folder',
    )
  })
})
