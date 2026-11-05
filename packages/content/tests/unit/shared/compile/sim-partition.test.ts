import { readFileSync, rmSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { Effect, Either } from 'effect'
import { beforeAll, describe, expect, it } from 'vitest'
import { z } from 'zod'
import {
  type CompiledContent,
  type ContentOptions,
  compileContent,
} from '#src/shared/compile/compile-content.ts'
import { formatDiagnostic } from '#src/shared/diagnostics/diagnostic.ts'
import { contentHash } from '#src/shared/hash/content-hash.ts'
import { contentRef, defineContentSchema, localized } from '#src/shared/schema/content-schema.ts'
import { copyFixture, FIXTURES, ROOM_KIND, SOUND_KIND, simRoomsOptions } from '#src/testing/fixture-game.ts'
import { SIM_ROOMS_HASH } from '#src/testing/sim-rooms-hash.ts'

const compile = (options: ContentOptions) => Effect.runPromise(Effect.either(compileContent(options)))

async function compiled(options: ContentOptions): Promise<CompiledContent> {
  const result = await compile(options)
  if (Either.isLeft(result)) throw new Error(JSON.stringify(result.left, null, 2))
  return result.right
}

const edit = (root: string, file: string, change: (text: string) => string): void => {
  const path = join(root, 'content', file)
  const before = readFileSync(path, 'utf8')
  const after = change(before)
  if (after === before) throw new Error(`the edit to ${file} changed nothing`)
  writeFileSync(path, after)
}

describe('the sim partition', () => {
  it('holds tuning and the sim kinds only, and hashes like the sim', async () => {
    const { data, sim } = await compiled(simRoomsOptions(copyFixture('sim-rooms')))
    expect(Object.keys(data).sort()).toEqual(['assets', 'flow', 'game', 'palette', 'room', 'sound', 'tuning'])
    expect(Object.keys(sim.data).sort()).toEqual(['room', 'tuning'])
    // The same objects as the full data, so nothing is parsed twice.
    expect(sim.data.room).toBe(data.room)
    expect(sim.data.tuning).toBe(data.tuning)
    expect(sim.hash).toBe(contentHash(sim.data))
    expect(sim.hash).not.toBe(contentHash(data))
  })

  it('has an empty tuning when there is no tuning.toml', async () => {
    const root = copyFixture('sim-rooms')
    rmSync(join(root, 'content/tuning.toml'))
    const { sim } = await compiled(simRoomsOptions(root))
    expect(sim.data.tuning).toEqual({})
  })

  let before: CompiledContent
  beforeAll(async () => {
    before = await compiled(simRoomsOptions(copyFixture('sim-rooms')))
  })

  it.each([
    ['a room', 'rooms/room-1.toml', (t: string) => t.replace('"#P.....#"', '"#.P....#"')],
    ["a room's localized source text", 'rooms/room-1.toml', (t: string) => t.replace('Mossy', 'Sunken')],
    ['a tuning value', 'tuning.toml', (t: string) => t.replace('value = -275', 'value = -300')],
  ])('moves with %s (and so does the full hash)', async (_what, file, change) => {
    const root = copyFixture('sim-rooms')
    edit(root, file, change)
    const after = await compiled(simRoomsOptions(root))
    expect(after.sim.hash).not.toBe(before.sim.hash)
    expect(after.hash).not.toBe(before.hash)
  })

  it.each([
    [
      'the store descriptors',
      'game.toml',
      (t: string) => t.replace('descriptors = []', 'descriptors = ["mild-fantasy-violence"]'),
    ],
    ['the estimated hours', 'game.toml', (t: string) => t.replace('0.5', '2')],
    ['the palette', 'palette.toml', (t: string) => t.replace('#131313', '#141414')],
    ['the flow', 'flow.toml', (t: string) => t.replace('event = "play"', 'event = "start"')],
    ['the preload list', 'assets.toml', (t: string) => t.replace('title.png', 'title-2.png')],
    ['a non-sim kind', 'sounds/chime.toml', (t: string) => t.replace('chime.ogg', 'bell.ogg')],
  ])('stays put when only %s changes (the full hash moves)', async (_what, file, change) => {
    const root = copyFixture('sim-rooms')
    edit(root, file, change)
    const after = await compiled(simRoomsOptions(root))
    expect(after.sim.hash).toBe(before.sim.hash)
    expect(after.hash).not.toBe(before.hash)
  })
})

describe('simReference', () => {
  const roomWithAmbience = defineContentSchema(
    'room',
    z.strictObject({
      title: localized(),
      tileSize: z.number().int().positive(),
      rows: z.array(z.string()),
      ambience: z.optional(contentRef('sound')),
    }),
    { folder: 'rooms' },
  )

  it('refuses a sim kind that refers to a non-sim kind, at the key', async () => {
    const root = copyFixture('sim-rooms')
    edit(root, 'rooms/room-1.toml', (t) => `ambience = "chime"\n${t}`)
    const result = await compile({ root, schemas: [roomWithAmbience, SOUND_KIND] })
    if (Either.isRight(result) || result.left._tag !== 'ContentCompileFailed')
      throw new Error('expected a refusal')
    expect(result.left.diagnostics.map(formatDiagnostic)).toEqual([
      'content/rooms/room-1.toml:1:1  ambience  simReference: room is sim content but sound is not; mark sound { sim: true } or keep the reference out of the sim',
    ])
  })

  it('adds no simReference when the target is not a registered kind (audit L1)', async () => {
    const roomWithNope = defineContentSchema(
      'room',
      z.strictObject({
        title: localized(),
        tileSize: z.number().int().positive(),
        rows: z.array(z.string()),
        ambience: z.optional(contentRef('nope')),
      }),
      { folder: 'rooms' },
    )
    const root = copyFixture('sim-rooms')
    edit(root, 'rooms/room-1.toml', (t) => `ambience = "chime"\n${t}`)
    const result = await compile({ root, schemas: [roomWithNope, SOUND_KIND] })
    if (Either.isRight(result) || result.left._tag !== 'ContentCompileFailed')
      throw new Error('expected a refusal')
    expect(result.left.diagnostics.map((d) => d.code)).toEqual(['wrongKind'])
  })

  it('lets a non-sim kind refer into sim content', async () => {
    // The fixture's sound already names room-1.
    const { sim } = await compiled({ root: copyFixture('sim-rooms'), schemas: [ROOM_KIND, SOUND_KIND] })
    expect(Object.keys(sim.data.room as object)).toEqual(['room-1'])
  })

  it('accepts the same reference once the target is sim content', async () => {
    const root = copyFixture('sim-rooms')
    edit(root, 'rooms/room-1.toml', (t) => `ambience = "chime"\n${t}`)
    const simSound = defineContentSchema('sound', SOUND_KIND.schema, SOUND_KIND.place)
    const { sim } = await compiled({ root, schemas: [roomWithAmbience, simSound] })
    expect(Object.keys(sim.data).sort()).toEqual(['room', 'sound', 'tuning'])
  })
})

describe('the committed parity fixture', () => {
  it('is what the compiler makes of sim-rooms, so the browsers check the real partition', async () => {
    const { sim, files } = await compiled(simRoomsOptions(copyFixture('sim-rooms')))
    // Compared as data: the formatter owns the committed file's layout, and the hash is over canonical JSON.
    const committed = JSON.parse(readFileSync(join(FIXTURES, 'sim-rooms/sim-content.json'), 'utf8'))
    expect(committed).toEqual(sim.data)
    expect(contentHash(committed)).toBe(SIM_ROOMS_HASH)
    expect(files.get('sim-content.hash')).toBe(`${SIM_ROOMS_HASH}\n`)
  })
})
