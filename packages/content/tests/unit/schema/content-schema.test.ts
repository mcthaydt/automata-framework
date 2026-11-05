import { describe, expect, it, vi } from 'vitest'
import { z } from 'zod'
import {
  configProblems,
  contentRef,
  contentRefKinds,
  defineContentSchema,
  localized,
  localizedTexts,
} from '#src/schema/content-schema.ts'
import { checkReferences, resolveMarkers } from '#src/schema/references.ts'

const song = defineContentSchema('song', z.strictObject({ displayName: localized() }), { folder: 'songs' })
const stage = defineContentSchema(
  'stage',
  z.strictObject({
    displayName: localized(),
    song: contentRef('song'),
    extras: z.optional(z.array(contentRef('song'))),
    byMood: z.optional(z.record(z.string(), contentRef('song'))),
    either: z.optional(z.union([z.number(), contentRef('stage')])),
  }),
  { folder: 'stages' },
)

describe('configProblems', () => {
  it('accepts distinct kinds in distinct places', () => {
    expect(configProblems([song, stage])).toEqual([])
  })

  it('refuses a bad, reserved or duplicate kind and a shared place', () => {
    const problems = configProblems([
      song,
      defineContentSchema('Song', z.object({}), { folder: 'other' }),
      defineContentSchema('tuning', z.object({}), { file: 'x.toml' }),
      defineContentSchema('song', z.object({}), { folder: 'again' }),
      defineContentSchema('melody', z.object({}), { folder: 'songs' }),
    ])
    expect(problems).toEqual([
      'kind "Song" must match ^[a-z][a-z0-9-]*$',
      'kind "tuning" is reserved for the built-in tuning.toml',
      'kind "song" is registered twice',
      'kinds "song" and "melody" both read songs/',
    ])
  })
})

describe('the sim option', () => {
  it('defaults to sim content, and keeps an explicit false', () => {
    expect(defineContentSchema('room', z.object({}), { folder: 'rooms' }).sim).toBe(true)
    expect(defineContentSchema('sound', z.object({}), { folder: 'sounds' }, { sim: false }).sim).toBe(false)
  })

  it('refuses a sim option that is not a boolean', () => {
    const bad = defineContentSchema('x', z.object({}), { folder: 'xs' }, { sim: 'yes' as never })
    expect(configProblems([bad])).toEqual(['kind "x": sim must be true or false'])
  })
})

describe('resolveMarkers', () => {
  it('finds references and localized text anywhere, and leaves plain strings', () => {
    const parsed = stage.schema.parse({
      displayName: 'Rooftops',
      song: 'dusk-run',
      extras: ['dawn', 'dusk-run'],
      byMood: { calm: 'dawn' },
      either: 'other/stage',
    })
    const resolved = resolveMarkers(parsed)
    expect(resolved.value).toEqual({
      displayName: 'Rooftops',
      song: 'dusk-run',
      extras: ['dawn', 'dusk-run'],
      byMood: { calm: 'dawn' },
      either: 'other/stage',
    })
    expect(resolved.refs).toEqual([
      { path: ['byMood', 'calm'], kind: 'song', id: 'dawn' },
      { path: ['either'], kind: 'stage', id: 'other/stage' },
      { path: ['extras', 0], kind: 'song', id: 'dawn' },
      { path: ['extras', 1], kind: 'song', id: 'dusk-run' },
      { path: ['song'], kind: 'song', id: 'dusk-run' },
    ])
    expect(resolved.texts).toEqual([{ path: ['displayName'], text: 'Rooftops' }])
  })

  it('refuses a reference that is not an ID', () => {
    expect(stage.schema.safeParse({ displayName: 'x', song: 'Dusk Run' }).success).toBe(false)
  })
})

// Ported from FloorFifty tests/content/validate/references.test.ts (122a220): unknown references and IDs of
// the wrong kind.
describe('checkReferences', () => {
  const ids = new Map([
    ['song', new Set(['dawn', 'dusk-run'])],
    ['stage', new Set(['rooftops'])],
  ])

  it('passes references that exist', () => {
    expect(checkReferences([{ path: ['song'], kind: 'song', id: 'dawn' }], ids)).toEqual([])
  })

  it('names an unknown reference and one of the wrong kind', () => {
    expect(
      checkReferences(
        [
          { path: ['song'], kind: 'song', id: 'dusk-rnu' },
          { path: ['extras', 0], kind: 'song', id: 'rooftops' },
        ],
        ids,
      ),
    ).toEqual([
      { path: ['song'], code: 'unknownReference', message: 'no song has the id dusk-rnu' },
      { path: ['extras', 0], code: 'wrongKind', message: 'rooftops is a stage, not a song' },
    ])
  })
})

// A game's `automata.content.ts`, or a Vite config, can be loaded through a different module runner than
// the compiler, which gives it a second copy of this module. Markers and registrations must still count.
describe('a second copy of the schema module', () => {
  it('makes markers and registrations the compiler recognizes', async () => {
    vi.resetModules()
    const copy = await import('#src/schema/content-schema.ts')
    expect(copy.contentRef).not.toBe(contentRef)
    const schema = z.strictObject({ song: copy.contentRef('song'), name: copy.localized() })
    const resolved = resolveMarkers(schema.parse({ song: 'dusk-run', name: 'Rooftops' }))
    expect(resolved.refs).toEqual([{ path: ['song'], kind: 'song', id: 'dusk-run' }])
    expect(resolved.texts).toEqual([{ path: ['name'], text: 'Rooftops' }])
    expect(contentRefKinds.get(schema.shape.song)).toEqual({ kind: 'song' })
    expect(localizedTexts.get(schema.shape.name)).toEqual({ localized: true })
  })
})
