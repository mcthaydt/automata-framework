import { execFileSync } from 'node:child_process'
import { mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { z } from 'zod'
import { contentRef, defineContentSchema, localized } from '../schema/content-schema'
import { renderTypes } from './render-types'

const song = defineContentSchema(
  'song',
  z.strictObject({ displayName: localized(), bpm: z.number(), mood: z.enum(['calm', 'tense']) }),
  { folder: 'songs' },
)
const stage = defineContentSchema(
  'stage',
  z.strictObject({
    song: contentRef('song'),
    extras: z.optional(z.array(contentRef('song'))),
    tags: z.record(z.string(), z.boolean()),
    seed: z.union([z.literal('random'), z.number().int()]),
    theme: z.strictObject({ layers: z.array(z.strictObject({ alias: z.string() })) }),
    when: z.date(),
  }),
  { folder: 'stage-files' },
)
const catalog = defineContentSchema('catalog', z.strictObject({ stages: z.array(contentRef('stage')) }), {
  file: 'catalog.toml',
})

const rendered = renderTypes({
  schemas: [song, stage, catalog],
  ids: new Map([
    ['song', ['dawn', 'dusk-run']],
    ['stage', ['rooftops']],
  ]),
  flow: { screens: ['Menu', 'Play'], events: ['play', 'quit'] },
  tuningNames: ['GRAVITY'],
  hasGame: false,
  hasAssets: false,
})

describe('renderTypes', () => {
  it('declares ID unions, item types and the virtual module', () => {
    expect(rendered).toContain("export type SongId = 'dawn' | 'dusk-run'")
    expect(rendered).toContain(
      "export type Song = {\n    readonly bpm: number\n    readonly displayName: string\n    readonly mood: 'calm' | 'tense'\n  }",
    )
    expect(rendered).toContain('readonly song: SongId')
    expect(rendered).toContain('readonly extras?: readonly SongId[]')
    expect(rendered).toContain('readonly tags: Readonly<Record<string, boolean>>')
    expect(rendered).toContain("readonly seed: 'random' | number")
    expect(rendered).toContain('readonly stages: readonly StageId[]')
    expect(rendered).toContain('readonly when: unknown /* stage.when has no JSON form */')
    expect(rendered).toContain("export type ScreenId = 'Menu' | 'Play'")
    expect(rendered).toContain("export type TuningName = 'GRAVITY'")
    expect(rendered).toContain('readonly song: Readonly<Record<SongId, Song>>')
    expect(rendered).toContain('readonly catalog: Catalog')
    expect(rendered).toContain('export const contentHash: string')
  })

  it('typechecks in a consumer, and a wrong ID is a type error', () => {
    const dir = mkdtempSync(join(tmpdir(), 'content-types-'))
    writeFileSync(join(dir, 'content.d.ts'), rendered)
    // The generated file imports AF's own types by package name; point that name at this package's source.
    writeFileSync(
      join(dir, 'tsconfig.json'),
      JSON.stringify({
        compilerOptions: {
          strict: true,
          noEmit: true,
          module: 'esnext',
          moduleResolution: 'bundler',
          // The package's source uses Node types (its file access), so the consumer needs them too.
          types: ['node'],
          typeRoots: [join(import.meta.dirname, '../../node_modules/@types')],
          paths: { '@mcthaydt/automata-content': [join(import.meta.dirname, '../index.ts')] },
        },
        include: ['*.ts'],
      }),
    )
    const tsc = join(import.meta.dirname, '../../../../node_modules/.bin/tsc')
    const check = (consumer: string): string => {
      writeFileSync(join(dir, 'consumer.ts'), consumer)
      try {
        execFileSync(tsc, ['-p', dir], { encoding: 'utf8' })
        return 'ok'
      } catch (error) {
        return String((error as { stdout?: string }).stdout)
      }
    }
    const good = [
      "import { content, type SongId } from 'virtual:automata/content'",
      "const id: SongId = 'dusk-run'",
      'const bpm: number = content.song[id].bpm',
      "const first = content.catalog.stages[0] satisfies 'rooftops' | undefined",
      'export { bpm, first }',
    ].join('\n')
    expect(check(good)).toBe('ok')
    expect(
      check("import type { SongId } from 'virtual:automata/content'\nexport const id: SongId = 'dusk-rnu'\n"),
    ).toContain('dusk-rnu')
  }, 60_000)
})
